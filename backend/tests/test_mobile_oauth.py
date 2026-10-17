"""Google sign-in for the Android app: custom-scheme deep link instead of a web page."""

from typing import Any
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient

from app.auth import oauth
from app.routers.auth import MOBILE_CALLBACK_URL
from tests.test_auth import (  # noqa: F401  (google_configured is a fixture)
    _callback,
    _fragment,
    _mock_google,
    google_configured,
)


@pytest.fixture(autouse=True)
def _google(google_configured: None) -> None:  # noqa: F811
    """Every test here needs Google credentials configured."""


def _state_from(response: Any) -> str:
    query = parse_qs(urlparse(response.headers["location"]).query)
    return query["state"][0]


def test_default_client_is_web(client: TestClient) -> None:
    response = client.get("/auth/google", follow_redirects=False)
    assert oauth.verify_state(_state_from(response)) == "web"


def test_mobile_client_is_recorded_in_state(client: TestClient) -> None:
    response = client.get("/auth/google", params={"client": "mobile"}, follow_redirects=False)
    assert response.status_code == 307
    assert oauth.verify_state(_state_from(response)) == "mobile"


def test_unknown_client_value_is_rejected(client: TestClient) -> None:
    response = client.get("/auth/google", params={"client": "evil"}, follow_redirects=False)
    assert response.status_code == 422


def test_unknown_client_in_state_falls_back_to_web() -> None:
    assert oauth.verify_state(oauth.create_state("something-else")) == "web"


def test_mobile_callback_redirects_to_app_deep_link(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _mock_google(monkeypatch)
    response = _callback(client, code="auth-code", state=oauth.create_state("mobile"))
    assert response.status_code == 307
    location = response.headers["location"]
    assert location.startswith(f"{MOBILE_CALLBACK_URL}#")
    tokens = _fragment(response)
    assert tokens["access_token"]
    assert tokens["refresh_token"]


def test_web_callback_still_redirects_to_frontend(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _mock_google(monkeypatch)
    response = _callback(client, code="auth-code", state=oauth.create_state("web"))
    assert response.headers["location"].startswith("http://localhost:5173/auth/callback#")


def test_mobile_denied_error_returns_to_app(client: TestClient) -> None:
    response = _callback(client, error="access_denied", state=oauth.create_state("mobile"))
    assert response.status_code == 307
    assert response.headers["location"] == f"{MOBILE_CALLBACK_URL}#error=access_denied"


def test_denied_error_with_bad_state_returns_to_web(client: TestClient) -> None:
    response = _callback(client, error="access_denied", state="garbage")
    assert response.headers["location"].startswith("http://localhost:5173/auth/callback#")


def test_mobile_unverified_google_email_is_still_refused(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _mock_google(
        monkeypatch,
        userinfo_response=(200, {"email": "gina@example.com", "email_verified": False}),
    )
    response = _callback(client, code="auth-code", state=oauth.create_state("mobile"))
    assert response.status_code == 403


def test_download_filename_header_is_exposed_to_browsers(client: TestClient) -> None:
    response = client.options(
        "/api/resumes/1/export/pdf",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    simple = client.get("/health", headers={"Origin": "http://localhost:5173"})
    exposed = simple.headers.get("access-control-expose-headers", "")
    assert "Content-Disposition" in exposed
