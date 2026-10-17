"""Google OAuth 2.0 (authorization code flow) helpers using httpx."""

import logging
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlencode

import httpx
import jwt

from app.config import settings
from app.exceptions import BadRequestError

logger = logging.getLogger(__name__)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
STATE_TTL_MINUTES = 10
_STATE_TYPE = "oauth_state"


def is_configured() -> bool:
    """True when Google client credentials are present."""
    return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)


CLIENT_WEB = "web"
CLIENT_MOBILE = "mobile"
CLIENTS = (CLIENT_WEB, CLIENT_MOBILE)


def create_state(client: str = CLIENT_WEB) -> str:
    """Create a signed, short-lived `state` value (CSRF protection).

    `client` records which app started the flow ("web" or "mobile") so the callback
    can return the user to the right place (web page vs. the app's deep link).
    """
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "type": _STATE_TYPE,
        "nonce": secrets.token_urlsafe(16),
        "client": client if client in CLIENTS else CLIENT_WEB,
        "exp": now + timedelta(minutes=STATE_TTL_MINUTES),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_state(state: str) -> str:
    """Return the client ("web"/"mobile") or raise BadRequestError for an invalid state."""
    try:
        payload = jwt.decode(
            state,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"require": ["exp"]},
        )
    except jwt.InvalidTokenError as exc:
        raise BadRequestError("Invalid or expired OAuth state") from exc
    if payload.get("type") != _STATE_TYPE:
        raise BadRequestError("Invalid or expired OAuth state")
    client = payload.get("client")
    return client if client in CLIENTS else CLIENT_WEB


def build_authorization_url(client: str = CLIENT_WEB) -> str:
    """Return the Google consent-screen URL including a signed state."""
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": create_state(client),
        "access_type": "online",
        "prompt": "select_account",
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


async def exchange_code(code: str) -> str:
    """Exchange an authorization code for a Google access token."""
    data = {
        "code": code,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(GOOGLE_TOKEN_URL, data=data)
    except httpx.HTTPError as exc:
        logger.error("Google token exchange failed: %s", type(exc).__name__)
        raise BadRequestError("Could not reach Google") from exc
    if response.status_code != 200:
        logger.warning("Google token exchange rejected: %s", response.status_code)
        raise BadRequestError("Google authorization failed")
    access_token = response.json().get("access_token")
    if not isinstance(access_token, str) or not access_token:
        raise BadRequestError("Google authorization failed")
    return access_token


async def fetch_userinfo(google_access_token: str) -> dict[str, Any]:
    """Fetch the Google profile (email, name, email_verified)."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {google_access_token}"},
            )
    except httpx.HTTPError as exc:
        logger.error("Google userinfo failed: %s", type(exc).__name__)
        raise BadRequestError("Could not reach Google") from exc
    if response.status_code != 200:
        raise BadRequestError("Could not fetch Google profile")
    info: dict[str, Any] = response.json()
    if not info.get("email"):
        raise BadRequestError("Google account has no email")
    return info
