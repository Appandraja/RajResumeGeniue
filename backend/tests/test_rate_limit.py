"""Rate limiting on auth and export endpoints."""

from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.rate_limit import limit_export, limit_login, limit_register


@pytest.fixture
def limits_on(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)


def _login(client: TestClient) -> int:
    response = client.post("/auth/login", json={"email": "nobody@example.com", "password": "x" * 8})
    return response.status_code


@pytest.mark.usefixtures("limits_on")
def test_login_is_limited_after_threshold(client: TestClient) -> None:
    statuses = [_login(client) for _ in range(limit_login.limit)]
    assert statuses == [401] * limit_login.limit

    blocked = client.post("/auth/login", json={"email": "nobody@example.com", "password": "x" * 8})
    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "RATE_LIMITED"
    assert int(blocked.headers["Retry-After"]) >= 1


@pytest.mark.usefixtures("limits_on")
def test_register_is_limited_after_threshold(client: TestClient) -> None:
    for i in range(limit_register.limit):
        body = {"email": f"user{i}@example.com", "password": "Sup3rSecret!", "full_name": "User"}
        assert client.post("/auth/register", json=body).status_code == 201
    body = {"email": "extra@example.com", "password": "Sup3rSecret!", "full_name": "User"}
    assert client.post("/auth/register", json=body).status_code == 429


@pytest.mark.usefixtures("limits_on")
def test_limits_are_independent_per_endpoint(client: TestClient) -> None:
    for _ in range(limit_login.limit + 1):
        _login(client)
    body = {"email": "ok@example.com", "password": "Sup3rSecret!", "full_name": "User"}
    assert client.post("/auth/register", json=body).status_code == 201


def test_limits_disabled_by_default_in_tests(client: TestClient) -> None:
    statuses = {_login(client) for _ in range(limit_login.limit + 5)}
    assert statuses == {401}


@pytest.mark.usefixtures("limits_on")
def test_export_is_limited(
    client: TestClient,
    auth_headers: dict[str, str],
    make_resume: Callable[..., dict[str, Any]],
) -> None:
    headers = auth_headers
    resume = make_resume(headers)
    url = f"/api/resumes/{resume['id']}/export/pdf"
    for _ in range(limit_export.limit):
        assert client.get(url, headers=headers).status_code == 200
    assert client.get(url, headers=headers).status_code == 429
