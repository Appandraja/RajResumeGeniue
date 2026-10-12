"""Template business logic."""

import logging

from sqlalchemy.orm import Session

from app.exceptions import NotFoundError
from app.models import Template

logger = logging.getLogger(__name__)


def list_active_templates(db: Session) -> list[Template]:
    """Return all active templates ordered by id."""
    return db.query(Template).filter(Template.is_active.is_(True)).order_by(Template.id).all()


def get_template(db: Session, template_id: int, active_only: bool = False) -> Template:
    """Return a template by id or raise NotFoundError.

    Args:
        db: Database session
        template_id: Template primary key
        active_only: Treat inactive templates as not found (used by public endpoints)
    """
    query = db.query(Template).filter(Template.id == template_id)
    if active_only:
        query = query.filter(Template.is_active.is_(True))
    template = query.first()
    if template is None:
        logger.info("Template %s not found", template_id)
        raise NotFoundError("Template")
    return template
