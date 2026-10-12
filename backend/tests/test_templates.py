"""Public template endpoints."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

from app import seed
from app.models import Template
from app.seed import seed_templates


def test_list_templates_returns_active_seeded(client: TestClient) -> None:
    response = client.get("/api/templates")
    assert response.status_code == 200
    body = response.json()
    assert [t["slug"] for t in body] == ["classic", "modern-clean", "compact"]
    assert all(t["is_active"] for t in body)
    assert {"id", "name", "slug", "description", "font_family", "accent_color"} <= body[0].keys()


def test_list_templates_is_public(client: TestClient) -> None:
    assert client.get("/api/templates").status_code == 200


def test_list_templates_excludes_inactive(client: TestClient, inactive_template_id: int) -> None:
    ids = [t["id"] for t in client.get("/api/templates").json()]
    assert inactive_template_id not in ids
    assert len(ids) == 2


def test_get_template(client: TestClient, template_id: int) -> None:
    response = client.get(f"/api/templates/{template_id}")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == template_id
    assert body["slug"] == "classic"
    assert body["font_family"] == "Times New Roman"


def test_get_missing_template_404(client: TestClient) -> None:
    response = client.get("/api/templates/9999")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_get_inactive_template_404(client: TestClient, inactive_template_id: int) -> None:
    assert client.get(f"/api/templates/{inactive_template_id}").status_code == 404


def test_get_template_non_integer_422(client: TestClient) -> None:
    assert client.get("/api/templates/abc").status_code == 422


def test_seed_is_idempotent(db: Session) -> None:
    assert seed_templates(db) == 0
    assert db.query(Template).count() == 3


def test_seed_main_inserts_templates(
    monkeypatch: pytest.MonkeyPatch, session_factory: sessionmaker[Session]
) -> None:
    monkeypatch.setattr(seed, "SessionLocal", session_factory)
    seed.main()
    check = session_factory()
    try:
        assert check.query(Template).count() == 3
    finally:
        check.close()
