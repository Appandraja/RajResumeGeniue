"""Public template endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.template import TemplateResponse
from app.services import template_service

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("", response_model=list[TemplateResponse])
async def list_templates(db: Session = Depends(get_db)) -> list[TemplateResponse]:
    """List active templates (public)."""
    templates = template_service.list_active_templates(db)
    return [TemplateResponse.model_validate(t) for t in templates]


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(template_id: int, db: Session = Depends(get_db)) -> TemplateResponse:
    """Get a single template by id (public)."""
    template = template_service.get_template(db, template_id, active_only=True)
    return TemplateResponse.model_validate(template)
