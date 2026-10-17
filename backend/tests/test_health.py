"""Health endpoint, exception handler shapes and misc app wiring."""

import asyncio
import logging

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import Settings
from app.database import get_db, normalize_database_url
from app.exceptions import (
    AppException,
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    UnauthorizedError,
    app_exception_handler,
    register_exception_handlers,
)
from app.main import configure_logging


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_unknown_route_404(client: TestClient) -> None:
    assert client.get("/nope").status_code == 404


def test_app_error_shape_and_www_authenticate(client: TestClient) -> None:
    response = client.get("/auth/me")
    assert response.status_code == 401
    assert response.json() == {"error": {"code": "UNAUTHORIZED", "message": "Not authenticated"}}
    assert response.headers["www-authenticate"] == "Bearer"


def test_not_found_error_shape(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.get("/api/resumes/99999", headers=auth_headers)
    assert response.status_code == 404
    assert response.json() == {"error": {"code": "NOT_FOUND", "message": "Resume not found"}}
    assert "www-authenticate" not in response.headers


@pytest.mark.parametrize(
    ("exc", "status", "code"),
    [
        (NotFoundError("Thing"), 404, "NOT_FOUND"),
        (ConflictError(), 409, "CONFLICT"),
        (BadRequestError(), 400, "BAD_REQUEST"),
        (UnauthorizedError(), 401, "UNAUTHORIZED"),
        (ForbiddenError(), 403, "FORBIDDEN"),
        (AppException(), 500, "INTERNAL_ERROR"),
        (AppException("x", code="CUSTOM", status_code=418), 418, "CUSTOM"),
    ],
)
def test_exception_classes(exc: AppException, status: int, code: str) -> None:
    assert exc.status_code == status
    assert exc.code == code


def test_unhandled_exception_returns_generic_500(caplog: pytest.LogCaptureFixture) -> None:
    mini = FastAPI()
    register_exception_handlers(mini)

    @mini.get("/boom")
    async def boom() -> None:
        raise RuntimeError("secret internal detail")

    with caplog.at_level(logging.ERROR), TestClient(mini, raise_server_exceptions=False) as c:
        response = c.get("/boom")
    assert response.status_code == 500
    assert response.json() == {
        "error": {"code": "INTERNAL_ERROR", "message": "Internal server error"}
    }
    assert "secret internal detail" not in response.text
    assert any("Unhandled error" in r.getMessage() for r in caplog.records)


def test_app_exception_handler_delegates_non_app_exceptions() -> None:
    class _Url:
        path = "/x"

    class _Req:
        method = "GET"
        url = _Url()

    response = asyncio.run(app_exception_handler(_Req(), ValueError("x")))  # type: ignore[arg-type]
    assert response.status_code == 500


def test_validation_error_is_422(client: TestClient) -> None:
    response = client.post("/auth/login", json={"email": "not-an-email", "password": "x"})
    assert response.status_code == 422


def test_cors_allows_frontend_origin(client: TestClient) -> None:
    response = client.options(
        "/health",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"},
    )
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_allowed_origins_dedupes_and_strips() -> None:
    s = Settings(
        DATABASE_URL="sqlite://",
        SECRET_KEY="k" * 40,
        FRONTEND_URL="http://a.test/",
        CORS_ORIGINS="http://a.test, http://b.test ,",
    )
    assert s.allowed_origins == ["http://a.test", "http://b.test"]


@pytest.mark.parametrize(
    "secret",
    [
        "k",
        "short-secret",
        "change-me",
        "x" * 31,
        "replace-with-output-of-openssl-rand-hex-32",  # the .env.example placeholder
        "change-me-generate-with-openssl-rand-hex-32",
    ],
)
def test_settings_reject_weak_secret_key(secret: str) -> None:
    with pytest.raises(ValidationError):
        Settings(DATABASE_URL="sqlite://", SECRET_KEY=secret)


def test_settings_reject_non_hmac_algorithm() -> None:
    with pytest.raises(ValidationError):
        Settings(DATABASE_URL="sqlite://", SECRET_KEY="k" * 40, ALGORITHM="none")


def test_normalize_database_url() -> None:
    assert normalize_database_url("postgresql://u:p@h/db") == "postgresql+psycopg2://u:p@h/db"
    assert normalize_database_url("sqlite://") == "sqlite://"


def test_get_db_yields_and_closes_session() -> None:
    gen = get_db()
    session = next(gen)
    assert session is not None
    with pytest.raises(StopIteration):
        next(gen)


def test_configure_logging_runs() -> None:
    configure_logging()
