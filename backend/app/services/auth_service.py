"""Business logic for authentication."""

import hmac
import logging
import secrets
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from typing import Any, cast

from sqlalchemy import ColumnElement, func, select, update
from sqlalchemy.orm import Session

from app.auth.jwt import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    refresh_token_expiry,
    verify_password,
)
from app.config import settings
from app.exceptions import AppException, ConflictError, ForbiddenError, UnauthorizedError
from app.models.password_reset import PasswordResetToken
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserUpdate,
)

logger = logging.getLogger(__name__)

RESET_CODE_DIGITS = 8
RESET_CODE_TTL_MINUTES = 15
RESET_MAX_ATTEMPTS = 5
RESET_MAX_REQUESTS_PER_HOUR = 3
INVALID_RESET_MESSAGE = "That code is invalid or has expired."


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.execute(
        select(User).where(User.email == _normalize_email(email))
    ).scalar_one_or_none()


def register_user(db: Session, data: RegisterRequest) -> User:
    if get_user_by_email(db, data.email) is not None:
        raise ConflictError("Email already registered")
    user = User(
        email=_normalize_email(data.email),
        hashed_password=hash_password(data.password),
        full_name=data.full_name.strip(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("User registered: id=%s", user.id)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User:
    user = get_user_by_email(db, email)
    if (
        user is None
        or user.hashed_password is None
        or not verify_password(password, str(user.hashed_password))
    ):
        raise UnauthorizedError("Invalid email or password")
    if not user.is_active:
        raise ForbiddenError("Account is disabled")
    return user


def issue_tokens(db: Session, user: User) -> TokenResponse:
    """Create an access token and persist a new (hashed) refresh token."""
    raw_refresh = generate_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token=hash_refresh_token(raw_refresh),
            expires_at=refresh_token_expiry(),
        )
    )
    db.commit()
    return TokenResponse(access_token=create_access_token(int(user.id)), refresh_token=raw_refresh)


def _find_refresh_token(db: Session, raw_token: str) -> RefreshToken | None:
    return db.execute(
        select(RefreshToken).where(RefreshToken.token == hash_refresh_token(raw_token))
    ).scalar_one_or_none()


def _is_expired(record: RefreshToken) -> bool:
    expires_at: datetime = record.expires_at  # type: ignore[assignment]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    return expires_at <= datetime.now(UTC)


def rotate_refresh_token(db: Session, raw_token: str) -> TokenResponse:
    """Validate a refresh token, revoke it and issue a fresh token pair."""
    record = _find_refresh_token(db, raw_token)
    if record is None:
        raise UnauthorizedError("Invalid refresh token")
    if record.revoked:
        # Reuse of a rotated token suggests theft: revoke the whole family.
        logger.warning("Refresh token reuse detected for user id=%s", record.user_id)
        revoke_all_user_tokens(db, int(record.user_id))
        raise UnauthorizedError("Invalid refresh token")
    if _is_expired(record):
        raise UnauthorizedError("Refresh token has expired")
    user = db.get(User, record.user_id)
    if user is None or not user.is_active:
        raise UnauthorizedError("Invalid refresh token")
    record.revoked = True  # type: ignore[assignment]
    db.commit()
    return issue_tokens(db, user)


def revoke_refresh_token(db: Session, raw_token: str) -> None:
    """Revoke a refresh token. Idempotent: unknown tokens are ignored."""
    record = _find_refresh_token(db, raw_token)
    if record is not None and not record.revoked:
        record.revoked = True  # type: ignore[assignment]
        db.commit()


def revoke_all_user_tokens(db: Session, user_id: int) -> None:
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked.is_(False))
        .values(revoked=True)
    )
    db.commit()


def update_user(db: Session, user: User, data: UserUpdate) -> User:
    if data.full_name is not None:
        user.full_name = data.full_name.strip()  # type: ignore[assignment]
    db.commit()
    db.refresh(user)
    return user


def get_or_create_google_user(db: Session, userinfo: dict[str, Any]) -> User:
    """Find the user for a Google profile or create one (links by email).

    Only Google accounts with a verified email are accepted. Linking to an existing
    local account whose email was never verified is treated as a possible
    pre-hijacking attempt: the local password is cleared and all sessions revoked,
    so only the Google identity (the real mailbox owner) can access the account.
    """
    if userinfo.get("email_verified") is not True:
        raise ForbiddenError("Your Google account email is not verified")

    email = _normalize_email(str(userinfo["email"]))
    user = get_user_by_email(db, email)
    if user is None:
        user = User(
            email=email,
            hashed_password=None,
            full_name=userinfo.get("name") or None,
            is_verified=True,
            oauth_provider="google",
        )
        db.add(user)
        logger.info("Google user created")
    else:
        if not user.is_verified and user.hashed_password is not None:
            logger.warning("Unverified local account linked to Google; clearing password")
            user.hashed_password = None  # type: ignore[assignment]
            revoke_all_user_tokens(db, int(user.id))
        if user.oauth_provider is None:
            user.oauth_provider = "google"
        user.is_verified = True  # type: ignore[assignment]
    db.commit()
    db.refresh(user)
    if not user.is_active:
        raise ForbiddenError("Account is disabled")
    return user


# ------------------------------------------------------------ password reset
def _hash_reset_code(user_id: int, code: str) -> str:
    """Keyed hash (HMAC-SHA256 with SECRET_KEY) so a DB leak cannot brute-force codes."""
    return hmac.new(
        settings.SECRET_KEY.encode("utf-8"), f"{user_id}:{code}".encode(), sha256
    ).hexdigest()


def _invalid_reset_code() -> AppException:
    return AppException(INVALID_RESET_MESSAGE, code="INVALID_RESET_CODE", status_code=400)


def request_password_reset(db: Session, email: str) -> tuple[str, str] | None:
    """Create a reset code for the account, if any.

    Returns (email, raw_code) to be mailed, or None when nothing should be sent. The
    caller must respond identically in both cases. Unknown emails do comparable work.
    """
    user = get_user_by_email(db, email)
    code = "".join(secrets.choice("0123456789") for _ in range(RESET_CODE_DIGITS))
    now = datetime.now(UTC)
    if user is None or not user.is_active:
        _hash_reset_code(0, code)  # keep timing similar to the real path
        db.execute(select(func.count(PasswordResetToken.id)).where(PasswordResetToken.user_id == 0))
        return None
    user_id = int(user.id)
    created_recently = cast(
        ColumnElement[bool], PasswordResetToken.created_at >= now - timedelta(hours=1)
    )
    recent = db.execute(
        select(func.count(PasswordResetToken.id)).where(
            PasswordResetToken.user_id == user_id, created_recently
        )
    ).scalar_one()
    if recent >= RESET_MAX_REQUESTS_PER_HOUR:
        logger.warning("Password reset request cap reached for user id=%s", user_id)
        return None
    db.execute(
        update(PasswordResetToken)
        .where(PasswordResetToken.user_id == user_id, PasswordResetToken.used.is_(False))
        .values(used=True)
    )
    db.add(
        PasswordResetToken(
            user_id=user_id,
            code_hash=_hash_reset_code(user_id, code),
            expires_at=now + timedelta(minutes=RESET_CODE_TTL_MINUTES),
            created_at=now,
        )
    )
    db.commit()
    return _normalize_email(email), code


def reset_password(db: Session, data: ResetPasswordRequest) -> None:
    """Verify a reset code and set the new password. Every failure is the same error."""
    user = get_user_by_email(db, data.email)
    if user is None or not user.is_active:
        _hash_reset_code(0, data.code)
        raise _invalid_reset_code()
    user_id = int(user.id)
    record = db.execute(
        select(PasswordResetToken)
        .where(PasswordResetToken.user_id == user_id, PasswordResetToken.used.is_(False))
        .order_by(PasswordResetToken.id.desc())
        .limit(1)
    ).scalar_one_or_none()
    if record is None:
        _hash_reset_code(user_id, data.code)
        raise _invalid_reset_code()
    expires_at: datetime = record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if expires_at <= datetime.now(UTC) or int(record.attempts) >= RESET_MAX_ATTEMPTS:
        record.used = True
        db.commit()
        raise _invalid_reset_code()
    if not hmac.compare_digest(_hash_reset_code(user_id, data.code.strip()), str(record.code_hash)):
        record.attempts = int(record.attempts) + 1
        if int(record.attempts) >= RESET_MAX_ATTEMPTS:
            record.used = True
        db.commit()
        raise _invalid_reset_code()
    user.hashed_password = hash_password(data.new_password)
    user.is_verified = True
    record.used = True
    db.commit()
    revoke_all_user_tokens(db, user_id)
    logger.info("Password reset completed for user id=%s", user_id)


def change_password(db: Session, user: User, data: ChangePasswordRequest) -> None:
    """Change the password of a signed-in user.

    Revokes the user's refresh tokens except the one in `data.refresh_token`, if given.
    Uses HTTP 400 (never 401) so clients do not mistake it for an expired session.
    """
    if user.hashed_password is None:
        raise AppException(
            'This account has no password yet. Use "Forgot password" to set one.',
            code="NO_PASSWORD_SET",
            status_code=400,
        )
    if not verify_password(data.current_password, str(user.hashed_password)):
        raise AppException(
            "Your current password is incorrect.", code="WRONG_PASSWORD", status_code=400
        )
    if verify_password(data.new_password, str(user.hashed_password)):
        raise AppException(
            "The new password must be different from the current one.",
            code="SAME_PASSWORD",
            status_code=400,
        )
    user.hashed_password = hash_password(data.new_password)  # type: ignore[assignment]
    conditions = [RefreshToken.user_id == user.id, RefreshToken.revoked.is_(False)]
    if data.refresh_token:
        conditions.append(RefreshToken.token != hash_refresh_token(data.refresh_token))
    db.execute(update(RefreshToken).where(*conditions).values(revoked=True))
    db.commit()
    logger.info("Password changed for user id=%s", user.id)
