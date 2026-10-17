"""Client IP resolution behind reverse proxies (X-Forwarded-For) and its effect on rate limits."""

import pytest
from fastapi.testclient import TestClient
from starlette.requests import Request

from app.config import Settings, settings
from app.rate_limit import client_ip, limit_register

PEER = "10.0.0.7"


def _request(xff: str | None = None, peer: str | None = PEER) -> Request:
    headers = [(b"x-forwarded-for", xff.encode())] if xff is not None else []
    scope = {"type": "http", "headers": headers, "client": (peer, 5555) if peer else None}
    return Request(scope)


@pytest.fixture
def hops(monkeypatch: pytest.MonkeyPatch):
    def _set(n: int) -> None:
        monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", n)

    return _set


def test_default_ignores_forwarded_for_entirely(hops) -> None:
    hops(0)
    assert client_ip(_request("203.0.113.5")) == PEER


def test_no_client_at_all(hops) -> None:
    hops(0)
    assert client_ip(_request(peer=None)) == "unknown"


def test_one_hop_uses_the_last_entry(hops) -> None:
    hops(1)
    assert client_ip(_request("203.0.113.5")) == "203.0.113.5"


def test_clients_cannot_spoof_by_prepending_entries(hops) -> None:
    hops(1)
    # The attacker controls everything on the LEFT; the proxy appended the real address.
    assert client_ip(_request("1.2.3.4, 5.6.7.8, 203.0.113.5")) == "203.0.113.5"


def test_two_hops_use_the_second_from_the_right(hops) -> None:
    hops(2)
    assert client_ip(_request("9.9.9.9, 203.0.113.5, 172.70.1.1")) == "203.0.113.5"


def test_missing_header_falls_back_to_the_peer(hops) -> None:
    hops(1)
    assert client_ip(_request()) == PEER


def test_chain_shorter_than_hops_falls_back_to_the_peer(hops) -> None:
    hops(3)
    assert client_ip(_request("203.0.113.5, 172.70.1.1")) == PEER


@pytest.mark.parametrize(
    "garbage", ["not-an-ip", "999.1.1.1", "<script>", "203.0.113.5:8080", ", ,"]
)
def test_malformed_entries_fall_back_to_the_peer(hops, garbage: str) -> None:
    hops(1)
    assert client_ip(_request(garbage)) == PEER


def test_ipv6_is_normalised(hops) -> None:
    hops(1)
    assert client_ip(_request("2001:0db8:0000:0000:0000:0000:0000:0001")) == "2001:db8::1"


def test_hops_setting_is_bounded() -> None:
    with pytest.raises(ValueError):
        Settings(DATABASE_URL="sqlite://", SECRET_KEY="k" * 40, TRUSTED_PROXY_HOPS=-1)
    with pytest.raises(ValueError):
        Settings(DATABASE_URL="sqlite://", SECRET_KEY="k" * 40, TRUSTED_PROXY_HOPS=6)


def _register(client: TestClient, i: int, xff: str):
    return client.post(
        "/auth/register",
        headers={"X-Forwarded-For": xff},
        json={
            "email": f"u{i}-{xff.replace('.', '-')}@example.com",
            "password": "Sup3rSecret!",
            "full_name": "U",
        },
    )


def test_without_proxy_trust_every_caller_shares_one_bucket(
    client: TestClient, monkeypatch, hops
) -> None:
    """Why TRUSTED_PROXY_HOPS must be set behind a proxy: by default the header is ignored."""
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    hops(0)
    codes = [
        _register(client, i, f"198.51.100.{i}").status_code for i in range(limit_register.limit + 2)
    ]
    assert codes[-1] == 429  # different "clients" are all limited together


def test_with_one_hop_each_real_client_has_its_own_bucket(
    client: TestClient, monkeypatch, hops
) -> None:
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    hops(1)
    abuser = "203.0.113.10"
    codes = [_register(client, i, abuser).status_code for i in range(limit_register.limit + 2)]
    assert codes[: limit_register.limit] == [201] * limit_register.limit
    assert codes[limit_register.limit :] == [429, 429]
    assert _register(client, 0, "198.51.100.77").status_code == 201  # unaffected


def test_rotating_leftmost_entries_does_not_evade_the_limit(
    client: TestClient, monkeypatch, hops
) -> None:
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    hops(1)
    real = "203.0.113.10"
    codes = [
        _register(client, i, f"10.9.8.{i}, {real}").status_code
        for i in range(limit_register.limit + 3)
    ]
    assert codes.count(429) == 3


def test_debug_headers_are_absent_by_default(client: TestClient) -> None:
    response = client.get("/health", headers={"X-Forwarded-For": "1.2.3.4"})
    assert "x-debug-client-ip" not in response.headers


def test_debug_middleware_reports_resolution_when_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.main import create_app

    monkeypatch.setattr(settings, "DEBUG_CLIENT_IP", True)
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 2)
    with TestClient(create_app()) as debug_client:
        response = debug_client.get(
            "/health", headers={"X-Forwarded-For": "9.9.9.9, 203.0.113.5, 172.70.1.1"}
        )
    assert response.headers["x-debug-client-ip"] == "203.0.113.5"
    assert response.headers["x-debug-forwarded-for"] == "9.9.9.9, 203.0.113.5, 172.70.1.1"
    assert response.headers["x-debug-peer"]
