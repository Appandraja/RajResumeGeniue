"""Password reset, change password and the mailer."""

import logging
import smtplib
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.config import settings
from app.models import PasswordResetToken, RefreshToken, User
from app.services import mailer
from tests.conftest import PASSWORD

FORGOT = "/auth/forgot-password"
RESET = "/auth/reset-password"
CHANGE = "/auth/change-password"
LOGIN = "/auth/login"
GENERIC = "If an account exists for that email, a reset code has been sent."
NEW_PASSWORD = "Brand-N3w-Pass!"
EMAIL = "alice@example.com"


@pytest.fixture
def sent(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, str, int]]:
    """Capture (email, code, minutes) instead of sending."""
    outbox: list[tuple[str, str, int]] = []
    monkeypatch.setattr(
        mailer,
        "send_password_reset_email",
        lambda to_email, code, minutes: outbox.append((to_email, code, minutes)),
    )
    return outbox


def _forgot(client: TestClient, email: str = EMAIL) -> Any:
    return client.post(FORGOT, json={"email": email})


def _reset(client: TestClient, code: str, password: str = NEW_PASSWORD, email: str = EMAIL) -> Any:
    return client.post(RESET, json={"email": email, "code": code, "new_password": password})


def _tokens(db: Session) -> list[PasswordResetToken]:
    db.expire_all()
    return db.query(PasswordResetToken).order_by(PasswordResetToken.id).all()


@pytest.fixture
def user_email(register_user: Callable[..., dict[str, str]]) -> str:
    register_user(EMAIL)
    return EMAIL


# --------------------------------------------------------------------- forgot
def test_forgot_identical_for_existing_and_unknown(
    client: TestClient, user_email: str, sent: list[tuple[str, str, int]]
) -> None:
    known = _forgot(client, user_email)
    unknown = _forgot(client, "nobody@example.com")
    assert known.status_code == unknown.status_code == 202
    assert known.json() == unknown.json() == {"message": GENERIC}
    assert [s[0] for s in sent] == [EMAIL]


def test_forgot_creates_hashed_code_with_15_min_expiry(
    client: TestClient, db: Session, user_email: str, sent: list[tuple[str, str, int]]
) -> None:
    before = datetime.now(UTC)
    _forgot(client)
    _, code, minutes = sent[0]
    assert len(code) == 8 and code.isdigit()
    assert minutes == 15
    record = _tokens(db)[0]
    assert code not in str(record.code_hash)
    expires = record.expires_at.replace(tzinfo=record.expires_at.tzinfo or UTC)
    delta = expires - before
    assert timedelta(minutes=14, seconds=50) < delta < timedelta(minutes=15, seconds=10)
    assert record.used is False and record.attempts == 0


def test_forgot_invalidates_older_codes(
    client: TestClient, db: Session, user_email: str, sent: list[tuple[str, str, int]]
) -> None:
    _forgot(client)
    _forgot(client)
    tokens = _tokens(db)
    assert [t.used for t in tokens] == [True, False]
    assert _reset(client, sent[0][1]).status_code == 400
    assert _reset(client, sent[1][1]).status_code == 204


def test_forgot_hourly_cap_still_202(
    client: TestClient, db: Session, user_email: str, sent: list[tuple[str, str, int]]
) -> None:
    for _ in range(4):
        assert _forgot(client).status_code == 202
    assert len(sent) == 3
    assert len(_tokens(db)) == 3


def test_forgot_inactive_user_gets_nothing(
    client: TestClient, db: Session, user_email: str, sent: list[tuple[str, str, int]]
) -> None:
    db.query(User).update({"is_active": False})
    db.commit()
    assert _forgot(client).status_code == 202
    assert sent == []


def test_forgot_invalid_email_422(client: TestClient) -> None:
    assert client.post(FORGOT, json={"email": "nope"}).status_code == 422


# ---------------------------------------------------------------------- reset
def test_reset_success_full_flow(
    client: TestClient, db: Session, user_email: str, sent: list[tuple[str, str, int]]
) -> None:
    old_tokens = client.post(LOGIN, json={"email": EMAIL, "password": PASSWORD}).json()
    db.query(User).update({"is_verified": False})
    db.commit()
    _forgot(client)
    response = _reset(client, sent[0][1])
    assert response.status_code == 204
    assert client.post(LOGIN, json={"email": EMAIL, "password": NEW_PASSWORD}).status_code == 200
    assert client.post(LOGIN, json={"email": EMAIL, "password": PASSWORD}).status_code == 401
    db.expire_all()
    assert db.query(User).one().is_verified is True
    assert _tokens(db)[0].used is True
    # Refresh tokens issued before the reset are revoked.
    refresh = client.post("/auth/refresh", json={"refresh_token": old_tokens["refresh_token"]})
    assert refresh.status_code == 401


def test_reset_revokes_all_refresh_tokens(
    client: TestClient, db: Session, user_email: str, sent: list[tuple[str, str, int]]
) -> None:
    client.post(LOGIN, json={"email": EMAIL, "password": PASSWORD})
    _forgot(client)
    _reset(client, sent[0][1])
    db.expire_all()
    rows = db.query(RefreshToken).all()
    assert len(rows) == 2
    assert all(r.revoked for r in rows)


def test_reset_code_is_single_use(
    client: TestClient, user_email: str, sent: list[tuple[str, str, int]]
) -> None:
    _forgot(client)
    code = sent[0][1]
    assert _reset(client, code).status_code == 204
    again = _reset(client, code, "An0ther-Pass!")
    assert again.status_code == 400
    assert again.json()["error"]["code"] == "INVALID_RESET_CODE"


def test_reset_wrong_code_counts_attempts_then_locks(
    client: TestClient, db: Session, user_email: str, sent: list[tuple[str, str, int]]
) -> None:
    _forgot(client)
    code = sent[0][1]
    wrong = "00000000" if code != "00000000" else "11111111"
    for i in range(1, 6):
        assert _reset(client, wrong).status_code == 400
        if i < 5:
            assert _tokens(db)[0].attempts == i
    response = _reset(client, code)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_RESET_CODE"
    assert _tokens(db)[0].used is True
    assert client.post(LOGIN, json={"email": EMAIL, "password": PASSWORD}).status_code == 200


def test_reset_attempts_limit_without_used_flag(
    client: TestClient, db: Session, user_email: str, sent: list[tuple[str, str, int]]
) -> None:
    _forgot(client)
    record = _tokens(db)[0]
    record.attempts = 5  # type: ignore[assignment]
    db.commit()
    assert _reset(client, sent[0][1]).status_code == 400


def test_reset_expired_code(
    client: TestClient, db: Session, user_email: str, sent: list[tuple[str, str, int]]
) -> None:
    _forgot(client)
    record = _tokens(db)[0]
    record.expires_at = datetime.now(UTC) - timedelta(seconds=1)  # type: ignore[assignment]
    db.commit()
    response = _reset(client, sent[0][1])
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_RESET_CODE"


def test_reset_errors_are_identical(
    client: TestClient, user_email: str, sent: list[tuple[str, str, int]]
) -> None:
    _forgot(client)
    unknown = _reset(client, "12345678", email="ghost@example.com")
    no_code = _reset(client, "12345678", email=EMAIL)  # wrong code
    assert unknown.status_code == no_code.status_code == 400
    assert unknown.json() == no_code.json()
    assert unknown.json()["error"] == {
        "code": "INVALID_RESET_CODE",
        "message": "That code is invalid or has expired.",
    }


def test_reset_without_any_code_requested(client: TestClient, user_email: str) -> None:
    response = _reset(client, "12345678")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_RESET_CODE"


def test_reset_inactive_user(
    client: TestClient, db: Session, user_email: str, sent: list[tuple[str, str, int]]
) -> None:
    _forgot(client)
    db.query(User).update({"is_active": False})
    db.commit()
    assert _reset(client, sent[0][1]).status_code == 400


def test_reset_weak_password_422(
    client: TestClient, user_email: str, sent: list[tuple[str, str, int]]
) -> None:
    _forgot(client)
    assert _reset(client, sent[0][1], password="short").status_code == 422
    assert _reset(client, sent[0][1], password="x" * 129).status_code == 422


def test_google_only_account_can_set_password(
    client: TestClient, db: Session, sent: list[tuple[str, str, int]]
) -> None:
    db.add(
        User(
            email="goog@example.com",
            hashed_password=None,
            full_name="G",
            is_verified=True,
            oauth_provider="google",
        )
    )
    db.commit()
    _forgot(client, "goog@example.com")
    assert _reset(client, sent[0][1], email="goog@example.com").status_code == 204
    login = client.post(LOGIN, json={"email": "goog@example.com", "password": NEW_PASSWORD})
    assert login.status_code == 200


# ----------------------------------------------------------------- rate limit
def test_forgot_rate_limited(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, sent: list[tuple[str, str, int]]
) -> None:
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    codes = [_forgot(client, "x@example.com").status_code for _ in range(6)]
    assert codes == [202] * 5 + [429]


def test_reset_rate_limited(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    codes = [_reset(client, "12345678", email="x@example.com").status_code for _ in range(11)]
    assert codes == [400] * 10 + [429]


# ------------------------------------------------------------ change password
def _signin(client: TestClient) -> dict[str, str]:
    return client.post(LOGIN, json={"email": EMAIL, "password": PASSWORD}).json()  # type: ignore[no-any-return]


def _auth(tokens: dict[str, str]) -> dict[str, str]:
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def test_change_password_requires_auth(client: TestClient) -> None:
    response = client.post(CHANGE, json={"current_password": "a", "new_password": NEW_PASSWORD})
    assert response.status_code == 401


def test_change_password_success_revokes_all_without_refresh_token(
    client: TestClient, db: Session, user_email: str
) -> None:
    tokens = _signin(client)
    response = client.post(
        CHANGE,
        json={"current_password": PASSWORD, "new_password": NEW_PASSWORD},
        headers=_auth(tokens),
    )
    assert response.status_code == 204
    assert client.post(LOGIN, json={"email": EMAIL, "password": NEW_PASSWORD}).status_code == 200
    assert client.post(LOGIN, json={"email": EMAIL, "password": PASSWORD}).status_code == 401
    refresh = client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert refresh.status_code == 401


def test_change_password_keeps_supplied_refresh_token(
    client: TestClient, db: Session, user_email: str
) -> None:
    keep = _signin(client)
    other = _signin(client)
    response = client.post(
        CHANGE,
        json={
            "current_password": PASSWORD,
            "new_password": NEW_PASSWORD,
            "refresh_token": keep["refresh_token"],
        },
        headers=_auth(keep),
    )
    assert response.status_code == 204
    assert (
        client.post("/auth/refresh", json={"refresh_token": other["refresh_token"]}).status_code
        == 401
    )


def test_change_password_kept_token_still_refreshes(client: TestClient, user_email: str) -> None:
    keep = _signin(client)
    _signin(client)
    client.post(
        CHANGE,
        json={
            "current_password": PASSWORD,
            "new_password": NEW_PASSWORD,
            "refresh_token": keep["refresh_token"],
        },
        headers=_auth(keep),
    )
    assert (
        client.post("/auth/refresh", json={"refresh_token": keep["refresh_token"]}).status_code
        == 200
    )


def test_change_password_wrong_current_is_400_not_401(client: TestClient, user_email: str) -> None:
    tokens = _signin(client)
    response = client.post(
        CHANGE,
        json={"current_password": "Wrong-password1", "new_password": NEW_PASSWORD},
        headers=_auth(tokens),
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "WRONG_PASSWORD"


def test_change_password_same_password(client: TestClient, user_email: str) -> None:
    tokens = _signin(client)
    response = client.post(
        CHANGE,
        json={"current_password": PASSWORD, "new_password": PASSWORD},
        headers=_auth(tokens),
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "SAME_PASSWORD"


def test_change_password_weak_new_422(client: TestClient, user_email: str) -> None:
    tokens = _signin(client)
    response = client.post(
        CHANGE,
        json={"current_password": PASSWORD, "new_password": "short"},
        headers=_auth(tokens),
    )
    assert response.status_code == 422


def test_change_password_no_password_set(client: TestClient, db: Session, user_email: str) -> None:
    tokens = _signin(client)
    db.query(User).update({"hashed_password": None})
    db.commit()
    response = client.post(
        CHANGE,
        json={"current_password": PASSWORD, "new_password": NEW_PASSWORD},
        headers=_auth(tokens),
    )
    assert response.status_code == 400
    body = response.json()["error"]
    assert body["code"] == "NO_PASSWORD_SET"
    assert "Forgot password" in body["message"]


# --------------------------------------------------------------------- mailer
def test_mailer_console_logs_code(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setattr(settings, "EMAIL_BACKEND", "console")
    with caplog.at_level(logging.WARNING, logger="app.services.mailer"):
        mailer.send_password_reset_email("a@example.com", "12345678", 15)
    assert "DEV ONLY" in caplog.text
    assert "a@example.com" in caplog.text
    assert "12345678" in caplog.text


def test_mailer_disabled_sends_nothing_and_hides_code(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setattr(settings, "EMAIL_BACKEND", "disabled")
    smtp = MagicMock()
    monkeypatch.setattr(smtplib, "SMTP", smtp)
    with caplog.at_level(logging.WARNING, logger="app.services.mailer"):
        mailer.send_password_reset_email("a@example.com", "12345678", 15)
    smtp.assert_not_called()
    assert "No email backend configured" in caplog.text
    assert "12345678" not in caplog.text


def test_mailer_smtp_uses_starttls(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setattr(settings, "EMAIL_BACKEND", "smtp")
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(settings, "SMTP_USERNAME", "user")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "pw")
    smtp_class = MagicMock()
    monkeypatch.setattr(smtplib, "SMTP", smtp_class)
    with caplog.at_level(logging.INFO, logger="app.services.mailer"):
        mailer.send_password_reset_email("a@example.com", "12345678", 15)
    smtp_class.assert_called_once()
    assert smtp_class.call_args.args[:2] == ("smtp.example.com", 587)
    server = smtp_class.return_value.__enter__.return_value
    server.starttls.assert_called_once()
    server.login.assert_called_once_with("user", "pw")
    message = server.send_message.call_args.args[0]
    body = message.get_content()
    assert "12345678" in body
    assert "15 minutes" in body
    assert "If you didn't request this, ignore this email" in body
    assert message["To"] == "a@example.com"
    assert "12345678" not in caplog.text


def test_mailer_smtp_without_tls_or_login(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "EMAIL_BACKEND", "smtp")
    monkeypatch.setattr(settings, "SMTP_HOST", "localhost")
    monkeypatch.setattr(settings, "SMTP_USE_TLS", False)
    monkeypatch.setattr(settings, "SMTP_USERNAME", "")
    smtp_class = MagicMock()
    monkeypatch.setattr(smtplib, "SMTP", smtp_class)
    mailer.send_password_reset_email("a@example.com", "12345678", 15)
    server = smtp_class.return_value.__enter__.return_value
    server.starttls.assert_not_called()
    server.login.assert_not_called()
    server.send_message.assert_called_once()


def test_mailer_smtp_missing_host(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setattr(settings, "EMAIL_BACKEND", "smtp")
    monkeypatch.setattr(settings, "SMTP_HOST", "")
    smtp_class = MagicMock()
    monkeypatch.setattr(smtplib, "SMTP", smtp_class)
    with caplog.at_level(logging.WARNING, logger="app.services.mailer"):
        mailer.send_password_reset_email("a@example.com", "12345678", 15)
    smtp_class.assert_not_called()
    assert "SMTP_HOST is empty" in caplog.text


def test_mailer_failure_never_propagates(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setattr(settings, "EMAIL_BACKEND", "smtp")
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(smtplib, "SMTP", MagicMock(side_effect=OSError("boom 12345678")))
    with caplog.at_level(logging.ERROR, logger="app.services.mailer"):
        mailer.send_password_reset_email("a@example.com", "12345678", 15)
    assert "OSError" in caplog.text
    assert "12345678" not in caplog.text


def test_forgot_request_survives_mail_failure(
    client: TestClient, user_email: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "EMAIL_BACKEND", "smtp")
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(smtplib, "SMTP", MagicMock(side_effect=OSError("down")))
    response = _forgot(client)
    assert response.status_code == 202
    assert response.json() == {"message": GENERIC}
