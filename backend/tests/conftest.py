"""Shared fixtures: isolated in-memory SQLite DB per test, TestClient, auth helpers."""

import os

# Settings must be in place BEFORE any `app.*` module is imported. Force (not setdefault)
# so a developer's real DATABASE_URL can never be touched by the test suite.
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SECRET_KEY"] = "test-only-secret-key-that-is-long-enough-for-hs256"
os.environ["GOOGLE_CLIENT_ID"] = ""
os.environ["GOOGLE_CLIENT_SECRET"] = ""
# Rate limiting is covered explicitly in test_rate_limit.py; keep it off elsewhere.
os.environ["RATE_LIMIT_ENABLED"] = "false"

from collections.abc import Callable, Generator  # noqa: E402
from functools import partial  # noqa: E402
from typing import Any  # noqa: E402

import bcrypt  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.engine import Engine, make_url  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.database import Base, get_db, normalize_database_url  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Template  # noqa: E402
from app.rate_limit import ALL_LIMITERS  # noqa: E402
from app.seed import seed_templates  # noqa: E402

PASSWORD = "Sup3rSecret!"


@pytest.fixture(autouse=True)
def _reset_rate_limiters() -> None:
    """Start every test with empty rate-limit windows."""
    for limiter in ALL_LIMITERS:
        limiter.reset()


@pytest.fixture(autouse=True)
def _fast_bcrypt(monkeypatch: pytest.MonkeyPatch) -> None:
    """Use the minimum bcrypt work factor so password hashing stays fast in tests."""
    monkeypatch.setattr(bcrypt, "gensalt", partial(bcrypt.gensalt, rounds=4))


def _make_test_engine() -> Engine:
    """In-memory SQLite by default; set TEST_DATABASE_URL to run the suite on PostgreSQL.

    The suite drops and recreates every table, so a URL is only accepted when its database
    name contains "test" (a safety net against pointing it at a real database).
    """
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        return create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
    database = make_url(url).database or ""
    if "test" not in database.lower():
        raise RuntimeError(
            f"Refusing to run tests against database {database!r}: its name must contain 'test'."
        )
    return create_engine(normalize_database_url(url), pool_pre_ping=True)


@pytest.fixture
def engine() -> Generator[Engine, None, None]:
    eng = _make_test_engine()
    Base.metadata.drop_all(bind=eng)  # clean slate even if a previous run crashed
    Base.metadata.create_all(bind=eng)
    yield eng
    Base.metadata.drop_all(bind=eng)
    eng.dispose()


@pytest.fixture
def session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autocommit=False, autoflush=False)


@pytest.fixture
def db(session_factory: sessionmaker[Session]) -> Generator[Session, None, None]:
    session = session_factory()
    seed_templates(session)
    yield session
    session.close()


@pytest.fixture
def client(
    db: Session, session_factory: sessionmaker[Session]
) -> Generator[TestClient, None, None]:
    """TestClient whose requests each get their own session on the shared in-memory DB."""

    def _override_get_db() -> Generator[Session, None, None]:
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def template_id(db: Session) -> int:
    """Id of an active seeded template."""
    template = db.query(Template).filter(Template.slug == "classic").one()
    return int(template.id)


@pytest.fixture
def inactive_template_id(db: Session) -> int:
    template = db.query(Template).filter(Template.slug == "compact").one()
    template.is_active = False  # type: ignore[assignment]
    db.commit()
    return int(template.id)


def _register(client: TestClient, email: str, full_name: str = "Test User") -> dict[str, str]:
    response = client.post(
        "/auth/register",
        json={"email": email, "password": PASSWORD, "full_name": full_name},
    )
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture
def register_user(client: TestClient) -> Callable[..., dict[str, str]]:
    """Factory: register a user and return its Authorization headers."""
    return partial(_register, client)


@pytest.fixture
def auth_headers(register_user: Callable[..., dict[str, str]]) -> dict[str, str]:
    return register_user("alice@example.com", "Alice Example")


@pytest.fixture
def other_headers(register_user: Callable[..., dict[str, str]]) -> dict[str, str]:
    return register_user("bob@example.com", "Bob Other")


def resume_payload(template_id: int, **overrides: Any) -> dict[str, Any]:
    """A valid resume-create payload with sensible defaults."""
    payload: dict[str, Any] = {
        "template_id": template_id,
        "title": "Backend Engineer Resume",
        "full_name": "Alice Example",
        "email": "alice@example.com",
        "phone": "+1 555 123 4567",
        "location": "Berlin, Germany",
        "linkedin_url": "https://linkedin.com/in/alice",
        "summary": "Backend engineer with a decade of experience building reliable services "
        "and mentoring teams.",
        "skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "AWS"],
        "sections": [
            {
                "type": "experience",
                "title": "Senior Engineer",
                "organization": "Acme",
                "start_date": "2020-01-01",
                "end_date": "2023-06-01",
                "bullets": ["Built the billing API", "Cut p99 latency by 40%"],
            },
            {
                "type": "education",
                "title": "BSc Computer Science",
                "organization": "State University",
                "start_date": "2012-09-01",
                "end_date": "2016-06-01",
            },
        ],
    }
    payload.update(overrides)
    return payload


@pytest.fixture
def make_resume(client: TestClient, template_id: int) -> Callable[..., dict[str, Any]]:
    """Factory: create a resume via the API and return the response JSON."""

    def _make(headers: dict[str, str], **overrides: Any) -> dict[str, Any]:
        response = client.post(
            "/api/resumes", json=resume_payload(template_id, **overrides), headers=headers
        )
        assert response.status_code == 201, response.text
        data: dict[str, Any] = response.json()
        return data

    return _make
