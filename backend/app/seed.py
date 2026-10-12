"""Idempotent seed data. Run from backend/: python -m app.seed"""

import logging

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Template

logger = logging.getLogger(__name__)

TEMPLATES: list[dict[str, str]] = [
    {
        "name": "Classic",
        "slug": "classic",
        "description": "Single column, Times New Roman, standard headings. Traditional, ATS-safe.",
        "font_family": "Times New Roman",
        "accent_color": "#000000",
    },
    {
        "name": "Modern Clean",
        "slug": "modern-clean",
        "description": "Single column, Calibri, subtle accent color, standard headings.",
        "font_family": "Calibri",
        "accent_color": "#1F4E79",
    },
    {
        "name": "Compact",
        "slug": "compact",
        "description": "Single column, Arial, tighter spacing to fit more content on one page.",
        "font_family": "Arial",
        "accent_color": "#333333",
    },
]


def seed_templates(db: Session) -> int:
    """Insert missing templates by slug. Returns number created."""
    created = 0
    for data in TEMPLATES:
        exists = db.query(Template).filter(Template.slug == data["slug"]).first()
        if exists is None:
            db.add(Template(**data, is_active=True))
            created += 1
    db.commit()
    return created


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    db = SessionLocal()
    try:
        count = seed_templates(db)
        logger.info("Seed complete: %d template(s) created", count)
    finally:
        db.close()


if __name__ == "__main__":
    main()
