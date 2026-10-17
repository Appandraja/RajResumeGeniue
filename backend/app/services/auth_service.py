"""Business logic for authentication."""

import logging
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.auth.jwt import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    refresh_token_expiry,
    verify_password,
)
from app.exceptions import ConflictError, ForbiddenError, UnauthorizedError
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import RegisterRequest, TokenResponse, UserUpdate

logger = logging.getLogger(__name__)


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
