"""Auth endpoints, JWT helpers and Google OAuth flow (httpx mocked, no real network)."""

from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import Any
from urllib.parse import parse_qs, urlparse

import httpx
import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth import oauth
from app.auth.jwt import (
    create_access_token,
    decode_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.config import settings
from app.exceptions import UnauthorizedError
from app.models import RefreshToken, User
from tests.conftest import PASSWORD

REGISTER = "/auth/register"
LOGIN = "/auth/login"


def _register(client: TestClient, email: str = "new@example.com", **extra: Any) -> Any:
    body = {"email": email, "password": PASSWORD, "full_name": "New User", **extra}
    return client.post(REGISTER, json=body)


def _login(client: TestClient, email: str, password: str = PASSWORD) -> Any:
    return client.post(LOGIN, json={"email": email, "password": password})


# ------------------------------------------------------------------ register
def test_register_success(client: TestClient, db: Session) -> None:
    response = _register(client)
    assert response.status_code == 201
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["refresh_token"]
    user = db.query(User).filter(User.email == "new@example.com").one()
    assert user.hashed_password != PASSWORD
    assert str(user.hashed_password).startswith("$2")


def test_register_stores_refresh_token_hashed(client: TestClient, db: Session) -> None:
    raw = _register(client).json()["refresh_token"]
    record = db.query(RefreshToken).one()
    assert record.token != raw
    assert record.token == hash_refresh_token(raw)


def test_register_duplicate_409(client: TestClient) -> None:
    assert _register(client).status_code == 201
    response = _register(client)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "CONFLICT"


def test_register_email_case_insensitive(client: TestClient, db: Session) -> None:
    assert _register(client, "Mixed.Case@Example.COM").status_code == 201
    assert _register(client, "mixed.case@example.com").status_code == 409
    assert _login(client, "MIXED.CASE@example.com").status_code == 200
    assert db.query(User).one().email == "mixed.case@example.com"


@pytest.mark.parametrize("password", ["short", "1234567", ""])
def test_register_short_password_422(client: TestClient, password: str) -> None:
    response = client.post(
        REGISTER, json={"email": "a@example.com", "password": password, "full_name": "A"}
    )
    assert response.status_code == 422


def test_register_too_long_password_422(client: TestClient) -> None:
    response = client.post(
        REGISTER, json={"email": "a@example.com", "password": "x" * 129, "full_name": "A"}
    )
    assert response.status_code == 422


@pytest.mark.parametrize(
    "body",
    [
        {"email": "not-an-email", "password": PASSWORD, "full_name": "A"},
        {"email": "a@example.com", "password": PASSWORD},
        {"email": "a@example.com", "password": PASSWORD, "full_name": ""},
        {"password": PASSWORD, "full_name": "A"},
    ],
)
def test_register_invalid_body_422(client: TestClient, body: dict[str, Any]) -> None:
    assert client.post(REGISTER, json=body).status_code == 422


def test_register_whitespace_only_name_rejected(client: TestClient) -> None:
    assert _register(client, full_name="   ").status_code == 422


# --------------------------------------------------------------------- login
def test_login_success(client: TestClient) -> None:
    _register(client)
    response = _login(client, "new@example.com")
    assert response.status_code == 200
    assert {"access_token", "refresh_token", "token_type"} <= response.json().keys()


def test_login_wrong_password_401(client: TestClient) -> None:
    _register(client)
    response = _login(client, "new@example.com", "WrongPassword1")
    assert response.status_code == 401
    assert response.json()["error"]["message"] == "Invalid email or password"


def test_login_unknown_email_same_error_as_wrong_password(client: TestClient) -> None:
    _register(client)
    unknown = _login(client, "ghost@example.com")
    wrong = _login(client, "new@example.com", "WrongPassword1")
    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json() == wrong.json()


def test_login_inactive_user_403(client: TestClient, db: Session) -> None:
    _register(client)
    db.query(User).update({User.is_active: False})
    db.commit()
    response = _login(client, "new@example.com")
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"


def test_login_oauth_only_user_cannot_password_login(client: TestClient, db: Session) -> None:
    db.add(User(email="g@example.com", hashed_password=None, oauth_provider="google"))
    db.commit()
    assert _login(client, "g@example.com").status_code == 401


# ------------------------------------------------------------------ me / put
def test_me_returns_profile_without_password(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    response = client.get("/auth/me", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "alice@example.com"
    assert body["full_name"] == "Alice Example"
    assert body["is_active"] is True
    assert "hashed_password" not in body
    assert "password" not in body


def test_update_me(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.put("/auth/me", json={"full_name": "  Alice B  "}, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["full_name"] == "Alice B"
    assert client.get("/auth/me", headers=auth_headers).json()["full_name"] == "Alice B"


def test_update_me_empty_body_keeps_values(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    response = client.put("/auth/me", json={}, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["full_name"] == "Alice Example"


def test_update_me_empty_name_422(client: TestClient, auth_headers: dict[str, str]) -> None:
    assert client.put("/auth/me", json={"full_name": ""}, headers=auth_headers).status_code == 422


def test_update_me_requires_auth(client: TestClient) -> None:
    assert client.put("/auth/me", json={"full_name": "X"}).status_code == 401


# --------------------------------------------------------- access-token auth
def _encode(payload: dict[str, Any], key: str | None = None) -> str:
    return jwt.encode(payload, key or settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def _bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_me_no_header_401(client: TestClient) -> None:
    assert client.get("/auth/me").status_code == 401


def test_me_malformed_token_401(client: TestClient) -> None:
    assert client.get("/auth/me", headers=_bearer("not.a.jwt")).status_code == 401


def test_me_non_bearer_scheme_401(client: TestClient) -> None:
    assert client.get("/auth/me", headers={"Authorization": "Basic abc"}).status_code == 401


def test_me_expired_token_401(client: TestClient, auth_headers: dict[str, str]) -> None:
    past = datetime.now(UTC) - timedelta(minutes=5)
    token = _encode({"sub": "1", "type": "access", "exp": past})
    response = client.get("/auth/me", headers=_bearer(token))
    assert response.status_code == 401
    assert response.json()["error"]["message"] == "Token has expired"


def test_me_wrong_type_token_401(client: TestClient, auth_headers: dict[str, str]) -> None:
    exp = datetime.now(UTC) + timedelta(minutes=5)
    token = _encode({"sub": "1", "type": "refresh", "exp": exp})
    assert client.get("/auth/me", headers=_bearer(token)).status_code == 401


def test_me_oauth_state_token_not_accepted_as_access(client: TestClient) -> None:
    assert client.get("/auth/me", headers=_bearer(oauth.create_state())).status_code == 401


def test_me_token_without_type_401(client: TestClient) -> None:
    exp = datetime.now(UTC) + timedelta(minutes=5)
    token = _encode({"sub": "1", "exp": exp})
    assert client.get("/auth/me", headers=_bearer(token)).status_code == 401


def test_me_token_signed_with_other_key_401(client: TestClient) -> None:
    exp = datetime.now(UTC) + timedelta(minutes=5)
    token = _encode({"sub": "1", "type": "access", "exp": exp}, key="x" * 40)
    assert client.get("/auth/me", headers=_bearer(token)).status_code == 401


def test_me_alg_none_token_401(client: TestClient) -> None:
    token = jwt.encode({"sub": "1", "type": "access"}, key=None, algorithm="none")
    assert client.get("/auth/me", headers=_bearer(token)).status_code == 401


def test_me_non_numeric_sub_401(client: TestClient) -> None:
    exp = datetime.now(UTC) + timedelta(minutes=5)
    token = _encode({"sub": "abc", "type": "access", "exp": exp})
    assert client.get("/auth/me", headers=_bearer(token)).status_code == 401


def test_me_token_for_missing_user_401(client: TestClient) -> None:
    assert client.get("/auth/me", headers=_bearer(create_access_token(9999))).status_code == 401


def test_me_inactive_user_401(
    client: TestClient, auth_headers: dict[str, str], db: Session
) -> None:
    db.query(User).update({User.is_active: False})
    db.commit()
    assert client.get("/auth/me", headers=auth_headers).status_code == 401


def test_refresh_token_cannot_be_used_as_access(client: TestClient) -> None:
    refresh = _register(client).json()["refresh_token"]
    assert client.get("/auth/me", headers=_bearer(refresh)).status_code == 401


# ------------------------------------------------------------------- refresh
def test_refresh_rotates_tokens(client: TestClient) -> None:
    first = _register(client).json()
    response = client.post("/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert response.status_code == 200
    second = response.json()
    assert second["refresh_token"] != first["refresh_token"]
    assert client.get("/auth/me", headers=_bearer(second["access_token"])).status_code == 200


def test_refresh_reuse_revokes_whole_family(client: TestClient, db: Session) -> None:
    first = _register(client).json()
    second = client.post("/auth/refresh", json={"refresh_token": first["refresh_token"]}).json()
    # Replaying the already-rotated token is treated as theft.
    replay = client.post("/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert replay.status_code == 401
    # ...and the legitimately issued successor is revoked too.
    successor = client.post("/auth/refresh", json={"refresh_token": second["refresh_token"]})
    assert successor.status_code == 401
    db.expire_all()
    assert all(t.revoked for t in db.query(RefreshToken).all())


def test_refresh_unknown_token_401(client: TestClient) -> None:
    response = client.post("/auth/refresh", json={"refresh_token": "does-not-exist"})
    assert response.status_code == 401


def test_refresh_expired_token_401(client: TestClient, db: Session) -> None:
    raw = _register(client).json()["refresh_token"]
    record = db.query(RefreshToken).one()
    record.expires_at = datetime.now(UTC) - timedelta(seconds=1)  # type: ignore[assignment]
    db.commit()
    response = client.post("/auth/refresh", json={"refresh_token": raw})
    assert response.status_code == 401
    assert response.json()["error"]["message"] == "Refresh token has expired"


def test_refresh_naive_expiry_is_treated_as_utc(client: TestClient, db: Session) -> None:
    raw = _register(client).json()["refresh_token"]
    record = db.query(RefreshToken).one()
    record.expires_at = (datetime.now(UTC) + timedelta(days=1)).replace(tzinfo=None)  # type: ignore[assignment]
    db.commit()
    assert client.post("/auth/refresh", json={"refresh_token": raw}).status_code == 200


def test_refresh_inactive_user_401(client: TestClient, db: Session) -> None:
    raw = _register(client).json()["refresh_token"]
    db.query(User).update({User.is_active: False})
    db.commit()
    assert client.post("/auth/refresh", json={"refresh_token": raw}).status_code == 401


def test_refresh_missing_body_422(client: TestClient) -> None:
    assert client.post("/auth/refresh", json={}).status_code == 422


# -------------------------------------------------------------------- logout
def test_logout_revokes_token_and_is_idempotent(client: TestClient) -> None:
    raw = _register(client).json()["refresh_token"]
    assert client.post("/auth/logout", json={"refresh_token": raw}).status_code == 204
    assert client.post("/auth/logout", json={"refresh_token": raw}).status_code == 204
    assert client.post("/auth/refresh", json={"refresh_token": raw}).status_code == 401


def test_logout_unknown_token_204(client: TestClient) -> None:
    assert client.post("/auth/logout", json={"refresh_token": "nope"}).status_code == 204


# ------------------------------------------------------------- jwt helpers
def test_password_hash_roundtrip() -> None:
    hashed = hash_password("correct horse")
    assert hashed.startswith("$2")
    assert verify_password("correct horse", hashed)
    assert not verify_password("wrong horse", hashed)


def test_hash_is_salted() -> None:
    assert hash_password("same") != hash_password("same")


def test_verify_password_with_garbage_hash_is_false() -> None:
    assert verify_password("x", "not-a-bcrypt-hash") is False


def test_long_password_does_not_raise() -> None:
    long_pw = "é" * 100  # > 72 bytes
    assert verify_password(long_pw, hash_password(long_pw))


def test_refresh_token_generation_unique_and_hash_stable() -> None:
    a, b = generate_refresh_token(), generate_refresh_token()
    assert a != b
    assert len(a) >= 40
    assert hash_refresh_token(a) == hash_refresh_token(a)
    assert len(hash_refresh_token(a)) == 64


def test_decode_access_token_roundtrip_and_errors() -> None:
    assert decode_access_token(create_access_token(42)) == 42
    with pytest.raises(UnauthorizedError):
        decode_access_token("garbage")


# ------------------------------------------------------------- Google OAuth
@pytest.fixture
def google_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "client-id.apps.googleusercontent.com")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "client-secret")
    monkeypatch.setattr(settings, "FRONTEND_URL", "http://localhost:5173")


def _mock_google(
    monkeypatch: pytest.MonkeyPatch,
    token_response: tuple[int, dict[str, Any]] = (200, {"access_token": "google-at"}),
    userinfo_response: tuple[int, dict[str, Any]] | None = None,
    raise_error: bool = False,
) -> list[httpx.Request]:
    """Route oauth.py's httpx.AsyncClient to an in-process MockTransport."""
    seen: list[httpx.Request] = []
    info = userinfo_response or (
        200,
        {"email": "Gina@Example.com", "name": "Gina G", "email_verified": True},
    )

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        if raise_error:
            raise httpx.ConnectError("boom", request=request)
        if str(request.url).startswith(oauth.GOOGLE_TOKEN_URL):
            return httpx.Response(token_response[0], json=token_response[1])
        if str(request.url).startswith(oauth.GOOGLE_USERINFO_URL):
            return httpx.Response(info[0], json=info[1])
        return httpx.Response(404)

    real_async_client = httpx.AsyncClient

    def factory(*args: Any, **kwargs: Any) -> httpx.AsyncClient:
        return real_async_client(*args, transport=httpx.MockTransport(handler), **kwargs)

    fake_httpx = SimpleNamespace(AsyncClient=factory, HTTPError=httpx.HTTPError)
    monkeypatch.setattr(oauth, "httpx", fake_httpx)
    return seen


def _callback(client: TestClient, **params: str) -> Any:
    return client.get("/auth/google/callback", params=params, follow_redirects=False)


def _fragment(response: Any) -> dict[str, str]:
    parsed = parse_qs(urlparse(response.headers["location"]).fragment)
    return {k: v[0] for k, v in parsed.items()}


def test_google_login_not_configured_400(client: TestClient) -> None:
    response = client.get("/auth/google", follow_redirects=False)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "BAD_REQUEST"


@pytest.mark.usefixtures("google_configured")
def test_google_login_redirects_with_signed_state(client: TestClient) -> None:
    response = client.get("/auth/google", follow_redirects=False)
    assert response.status_code == 307
    location = urlparse(response.headers["location"])
    assert f"{location.scheme}://{location.netloc}{location.path}" == oauth.GOOGLE_AUTH_URL
    query = {k: v[0] for k, v in parse_qs(location.query).items()}
    assert query["client_id"] == "client-id.apps.googleusercontent.com"
    assert query["response_type"] == "code"
    assert query["redirect_uri"] == settings.GOOGLE_REDIRECT_URI
    oauth.verify_state(query["state"])  # must not raise


@pytest.mark.usefixtures("google_configured")
def test_google_states_are_unique() -> None:
    assert oauth.create_state() != oauth.create_state()


def test_google_callback_error_param_redirects_to_frontend(client: TestClient) -> None:
    response = _callback(client, error="access_denied")
    assert response.status_code == 307
    location = response.headers["location"]
    assert location.startswith("http://localhost:5173/auth/callback#")
    assert _fragment(response) == {"error": "access_denied"}


@pytest.mark.usefixtures("google_configured")
def test_google_callback_missing_params_400(client: TestClient) -> None:
    assert _callback(client).status_code == 400
    assert _callback(client, code="abc").status_code == 400
    assert _callback(client, state="abc").status_code == 400


@pytest.mark.usefixtures("google_configured")
def test_google_callback_bad_state_400(client: TestClient) -> None:
    response = _callback(client, code="abc", state="forged")
    assert response.status_code == 400
    assert response.json()["error"]["message"] == "Invalid or expired OAuth state"


@pytest.mark.usefixtures("google_configured")
def test_google_callback_expired_state_400(client: TestClient) -> None:
    past = datetime.now(UTC) - timedelta(minutes=1)
    state = _encode({"type": "oauth_state", "nonce": "n", "exp": past})
    assert _callback(client, code="abc", state=state).status_code == 400


@pytest.mark.usefixtures("google_configured")
def test_google_callback_access_token_as_state_400(client: TestClient) -> None:
    state = create_access_token(1)
    assert _callback(client, code="abc", state=state).status_code == 400


def test_google_callback_not_configured_400(client: TestClient) -> None:
    assert _callback(client, code="abc", state="abc").status_code == 400


@pytest.mark.usefixtures("google_configured")
def test_google_callback_creates_new_user(
    client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    seen = _mock_google(monkeypatch)
    response = _callback(client, code="auth-code", state=oauth.create_state())
    assert response.status_code == 307
    assert response.headers["location"].startswith("http://localhost:5173/auth/callback#")
    tokens = _fragment(response)
    assert tokens["access_token"]
    assert tokens["refresh_token"]
    assert len(seen) == 2  # token exchange + userinfo
    assert seen[1].headers["authorization"] == "Bearer google-at"

    user = db.query(User).one()
    assert user.email == "gina@example.com"
    assert user.oauth_provider == "google"
    assert user.is_verified is True
    assert user.hashed_password is None
    me = client.get("/auth/me", headers=_bearer(tokens["access_token"]))
    assert me.status_code == 200
    assert me.json()["full_name"] == "Gina G"


@pytest.mark.usefixtures("google_configured")
def test_google_callback_links_existing_user(
    client: TestClient,
    db: Session,
    register_user: Callable[..., dict[str, str]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    register_user("gina@example.com", "Gina Local")
    _mock_google(monkeypatch)
    response = _callback(client, code="auth-code", state=oauth.create_state())
    assert response.status_code == 307
    db.expire_all()
    user = db.query(User).one()  # no duplicate account
    assert user.oauth_provider == "google"
    assert user.is_verified is True
    assert user.full_name == "Gina Local"


@pytest.mark.usefixtures("google_configured")
def test_google_link_to_unverified_local_account_clears_password_and_sessions(
    client: TestClient,
    db: Session,
    register_user: Callable[..., dict[str, str]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Pre-hijacking guard: an attacker-seeded password must not survive a Google link."""
    register_user("gina@example.com", "Attacker Seeded")
    _mock_google(monkeypatch)
    response = _callback(client, code="auth-code", state=oauth.create_state())
    assert response.status_code == 307

    db.expire_all()
    user = db.query(User).one()
    assert user.hashed_password is None
    assert _login(client, "gina@example.com").status_code == 401  # attacker password is dead
    # The attacker's registration session was revoked; only the new Google session is live.
    live = db.query(RefreshToken).filter(RefreshToken.revoked.is_(False)).all()
    assert len(live) == 1


@pytest.mark.usefixtures("google_configured")
def test_google_link_to_verified_local_account_keeps_password(
    client: TestClient,
    db: Session,
    register_user: Callable[..., dict[str, str]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    register_user("gina@example.com", "Gina Local")
    db.query(User).update({User.is_verified: True})
    db.commit()
    _mock_google(monkeypatch)
    response = _callback(client, code="auth-code", state=oauth.create_state())
    assert response.status_code == 307
    db.expire_all()
    assert db.query(User).one().hashed_password is not None
    assert _login(client, "gina@example.com").status_code == 200


@pytest.mark.usefixtures("google_configured")
def test_google_unverified_email_must_not_link_existing_account(
    client: TestClient,
    register_user: Callable[..., dict[str, str]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    register_user("gina@example.com", "Gina Local")
    _mock_google(
        monkeypatch,
        userinfo_response=(200, {"email": "gina@example.com", "email_verified": False}),
    )
    response = _callback(client, code="auth-code", state=oauth.create_state())
    assert response.status_code == 403
    assert "access_token" not in response.headers.get("location", "")


@pytest.mark.usefixtures("google_configured")
def test_google_unverified_email_does_not_create_user(
    client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    _mock_google(
        monkeypatch,
        userinfo_response=(200, {"email": "new@example.com", "email_verified": False}),
    )
    response = _callback(client, code="auth-code", state=oauth.create_state())
    assert response.status_code == 403
    assert db.query(User).count() == 0


@pytest.mark.usefixtures("google_configured")
def test_google_callback_inactive_user_403(
    client: TestClient,
    db: Session,
    register_user: Callable[..., dict[str, str]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    register_user("gina@example.com")
    db.query(User).update({User.is_active: False})
    db.commit()
    _mock_google(monkeypatch)
    response = _callback(client, code="auth-code", state=oauth.create_state())
    assert response.status_code == 403


@pytest.mark.usefixtures("google_configured")
def test_google_callback_token_exchange_rejected_400(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _mock_google(monkeypatch, token_response=(400, {"error": "invalid_grant"}))
    response = _callback(client, code="bad", state=oauth.create_state())
    assert response.status_code == 400


@pytest.mark.usefixtures("google_configured")
def test_google_callback_token_missing_access_token_400(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _mock_google(monkeypatch, token_response=(200, {}))
    assert _callback(client, code="c", state=oauth.create_state()).status_code == 400


@pytest.mark.usefixtures("google_configured")
def test_google_callback_userinfo_failure_400(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _mock_google(monkeypatch, userinfo_response=(401, {}))
    assert _callback(client, code="c", state=oauth.create_state()).status_code == 400


@pytest.mark.usefixtures("google_configured")
def test_google_callback_userinfo_without_email_400(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _mock_google(monkeypatch, userinfo_response=(200, {"name": "No Email"}))
    assert _callback(client, code="c", state=oauth.create_state()).status_code == 400


@pytest.mark.usefixtures("google_configured")
def test_google_callback_network_error_400(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _mock_google(monkeypatch, raise_error=True)
    response = _callback(client, code="c", state=oauth.create_state())
    assert response.status_code == 400
    assert response.json()["error"]["message"] == "Could not reach Google"


@pytest.mark.usefixtures("google_configured")
def test_google_userinfo_network_error_400(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    import asyncio

    from app.exceptions import BadRequestError

    _mock_google(monkeypatch, raise_error=True)
    with pytest.raises(BadRequestError):
        asyncio.run(oauth.fetch_userinfo("token"))
