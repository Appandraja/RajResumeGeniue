"""Resume export endpoints (PDF, DOCX). Authenticated and user-scoped."""

import logging
from typing import cast

from fastapi import APIRouter, Depends, Response
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.rate_limit import limit_export
from app.services import export_service, resume_service, template_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/resumes", tags=["export"])

_DOCX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def _download_headers(title: str, ext: str) -> dict[str, str]:
    filename = export_service.safe_filename(title, ext)
    return {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Cache-Control": "no-store",
    }


def _load_document(db: Session, user: User, resume_id: int) -> export_service.ExportDocument:
    resume = resume_service.get_owned_resume(db, cast(int, user.id), resume_id)
    # Inactive templates are still allowed so older resumes keep exporting.
    template = template_service.get_template(db, cast(int, resume.template_id))
    return export_service.build_export_document(resume, template)


@router.get("/{resume_id}/export/pdf", dependencies=[Depends(limit_export)])
async def export_pdf(
    resume_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    """Download the resume as an ATS-friendly PDF."""
    document = _load_document(db, user, resume_id)
    content = await run_in_threadpool(export_service.render_pdf, document)
    logger.info("Exported resume %s as PDF (%d bytes)", resume_id, len(content))
    return Response(
        content=content,
        media_type="application/pdf",
        headers=_download_headers(document.title, "pdf"),
    )


@router.get("/{resume_id}/export/docx", dependencies=[Depends(limit_export)])
async def export_docx(
    resume_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    """Download the resume as an ATS-friendly DOCX."""
    document = _load_document(db, user, resume_id)
    content = await run_in_threadpool(export_service.render_docx, document)
    logger.info("Exported resume %s as DOCX (%d bytes)", resume_id, len(content))
    return Response(
        content=content,
        media_type=_DOCX_MEDIA_TYPE,
        headers=_download_headers(document.title, "docx"),
    )
