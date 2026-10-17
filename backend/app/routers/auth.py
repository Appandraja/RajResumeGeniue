"""Authentication endpoints."""

import logging
from typing import Literal
from urllib.parse import urlencode

from fastapi import APIRouter, BackgroundTasks, Depends, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.auth import oauth
from app.config import settings
from app.dependencies import get_current_user, get_db
from app.exceptions import BadRequestError
from app.models.user import User
from app.rate_limit import (
    limit_forgot,
    limit_google,
    limit_login,
    limit_refresh,
    limit_register,
    limit_reset,
)
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    LogoutRequest,
    MessageResponse,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserResponse,
    UserUpdate,
)
from app.services import auth_service, mailer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

# Custom URL scheme registered by the Android app (see AndroidManifest.xml).
MOBILE_CALLBACK_URL = "rajresumegenie://auth/callback"


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(limit_register)],
)
async def register(data: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = auth_service.register_user(db, data)
    return auth_service.issue_tokens(db, user)


@router.post("/login", response_model=TokenResponse, dependencies=[Depends(limit_login)])
async def login(data: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = auth_service.authenticate_user(db, data.email, data.password)
    return auth_service.issue_tokens(db, user)


@router.post("/refresh", response_model=TokenResponse, dependencies=[Depends(limit_refresh)])
async def refresh(data: RefreshRequest, db: Session = Depends(get_db)) -> TokenResponse:
    return auth_service.rotate_refresh_token(db, data.refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(data: LogoutRequest, db: Session = Depends(get_db)) -> Response:
    auth_service.revoke_refresh_token(db, data.refresh_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(limit_forgot)],
)
async def forgot_password(
    data: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Always answers the same way so account existence cannot be probed."""
    pending = auth_service.request_password_reset(db, data.email)
    if pending is not None:
        email, code = pending
        background_tasks.add_task(
            mailer.send_password_reset_email, email, code, auth_service.RESET_CODE_TTL_MINUTES
        )
    return MessageResponse(
        message="If an account exists for that email, a reset code has been sent."
    )


@router.post(
    "/reset-password",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(limit_reset)],
)
async def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)) -> Response:
    auth_service.reset_password(db, data)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/change-password",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(limit_reset)],
)
async def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    auth_service.change_password(db, current_user, data)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserResponse)
async def read_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_me(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    return auth_service.update_user(db, current_user, data)


@router.get("/google", dependencies=[Depends(limit_google)])
async def google_login(client: Literal["web", "mobile"] = "web") -> RedirectResponse:
    """Start Google sign-in. The mobile app passes `client=mobile` to get a deep-link return."""
    if not oauth.is_configured():
        raise BadRequestError("Google OAuth is not configured")
    return RedirectResponse(oauth.build_authorization_url(client))


def _callback_base(client: str) -> str:
    """Where to send the user after Google: the web app page or the mobile app deep link."""
    if client == oauth.CLIENT_MOBILE:
        return MOBILE_CALLBACK_URL
    return f"{settings.FRONTEND_URL.rstrip('/')}/auth/callback"


def _client_from_state(state: str | None) -> str:
    """Best-effort client lookup for error redirects; unknown or invalid state means web."""
    if not state:
        return oauth.CLIENT_WEB
    try:
        return oauth.verify_state(state)
    except BadRequestError:
        return oauth.CLIENT_WEB


@router.get("/google/callback")
async def google_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
) -> RedirectResponse:
    if error is not None:
        logger.info("Google OAuth denied: %s", error)
        base = _callback_base(_client_from_state(state))
        return RedirectResponse(f"{base}#{urlencode({'error': error})}")
    if not oauth.is_configured():
        raise BadRequestError("Google OAuth is not configured")
    if not code or not state:
        raise BadRequestError("Missing code or state")
    client = oauth.verify_state(state)
    google_token = await oauth.exchange_code(code)
    userinfo = await oauth.fetch_userinfo(google_token)
    user = auth_service.get_or_create_google_user(db, userinfo)
    tokens = auth_service.issue_tokens(db, user)
    fragment = urlencode(
        {"access_token": tokens.access_token, "refresh_token": tokens.refresh_token}
    )
    return RedirectResponse(f"{_callback_base(client)}#{fragment}")
