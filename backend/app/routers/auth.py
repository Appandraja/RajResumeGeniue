"""Authentication endpoints."""

import logging
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.auth import oauth
from app.config import settings
from app.dependencies import get_current_user, get_db
from app.exceptions import BadRequestError
from app.models.user import User
from app.rate_limit import limit_google, limit_login, limit_refresh, limit_register
from app.schemas.auth import (
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
    UserUpdate,
)
from app.services import auth_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


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
async def google_login() -> RedirectResponse:
    if not oauth.is_configured():
        raise BadRequestError("Google OAuth is not configured")
    return RedirectResponse(oauth.build_authorization_url())


@router.get("/google/callback")
async def google_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
) -> RedirectResponse:
    frontend_callback = f"{settings.FRONTEND_URL.rstrip('/')}/auth/callback"
    if error is not None:
        logger.info("Google OAuth denied: %s", error)
        return RedirectResponse(f"{frontend_callback}#{urlencode({'error': error})}")
    if not oauth.is_configured():
        raise BadRequestError("Google OAuth is not configured")
    if not code or not state:
        raise BadRequestError("Missing code or state")
    oauth.verify_state(state)
    google_token = await oauth.exchange_code(code)
    userinfo = await oauth.fetch_userinfo(google_token)
    user = auth_service.get_or_create_google_user(db, userinfo)
    tokens = auth_service.issue_tokens(db, user)
    fragment = urlencode(
        {"access_token": tokens.access_token, "refresh_token": tokens.refresh_token}
    )
    return RedirectResponse(f"{frontend_callback}#{fragment}")
