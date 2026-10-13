"""Application settings loaded from environment variables / .env file."""

from functools import cached_property
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_PLACEHOLDER_SECRETS = {
    "change-me",
    "changeme",
    "your-secret-key",
    "secret",
    "your-secret-key-change-in-production",
}


_PLACEHOLDER_PREFIXES = ("replace-with", "change-me", "your-secret")


class Settings(BaseSettings):
    """Typed application settings. Secrets must come from the environment."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "RajResumeGenie"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # Required: no defaults so secrets are never hardcoded.
    DATABASE_URL: str
    SECRET_KEY: str

    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # In-process, per-client-IP request limits on auth and export endpoints.
    RATE_LIMIT_ENABLED: bool = True

    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/auth/google/callback"

    FRONTEND_URL: str = "http://localhost:5173"
    # Comma-separated extra CORS origins (FRONTEND_URL is always included).
    CORS_ORIGINS: str = ""

    # Outgoing email (password reset codes). "console" is for local development only:
    # it writes the code to the server log. "disabled" sends nothing.
    EMAIL_BACKEND: Literal["disabled", "console", "smtp"] = "disabled"
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "no-reply@rajresumegenie.local"
    SMTP_USE_TLS: bool = True

    @field_validator("SECRET_KEY")
    @classmethod
    def _secret_key_is_strong(cls, value: str) -> str:
        """Reject short or placeholder signing keys so tokens cannot be forged."""
        lowered = value.lower()
        is_placeholder = lowered in _PLACEHOLDER_SECRETS or lowered.startswith(
            _PLACEHOLDER_PREFIXES
        )
        if len(value) < 32 or is_placeholder:
            raise ValueError("SECRET_KEY must be a random string of at least 32 characters")
        return value

    @field_validator("ALGORITHM")
    @classmethod
    def _algorithm_is_hmac(cls, value: str) -> str:
        if value not in {"HS256", "HS384", "HS512"}:
            raise ValueError("ALGORITHM must be one of HS256, HS384, HS512")
        return value

    @cached_property
    def allowed_origins(self) -> list[str]:
        """Origins permitted by CORS."""
        extra = [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]
        origins = [self.FRONTEND_URL.rstrip("/"), *extra]
        return list(dict.fromkeys(origins))


settings = Settings()  # type: ignore[call-arg]
