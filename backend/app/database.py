"""Database engine, session factory and FastAPI dependency."""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings
from app.models.base import Base


def normalize_database_url(url: str) -> str:
    """Pin bare postgres URLs to psycopg2 (SQLAlchemy 2.1 defaults to psycopg v3)."""
    for scheme in ("postgresql://", "postgres://"):
        if url.startswith(scheme):
            return "postgresql+psycopg2://" + url[len(scheme) :]
    return url


# Required setting: there is intentionally no default, so credentials are never hardcoded.
DATABASE_URL: str = normalize_database_url(settings.DATABASE_URL)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

__all__ = ["Base", "engine", "SessionLocal", "get_db"]


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
