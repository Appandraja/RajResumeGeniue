"""Resume export endpoint (PDF, DOCX, ODT, RTF, TXT, Markdown, HTML). Authenticated, user-scoped."""

import logging
from typing import cast

from fastapi import APIRouter, Depends, Path, Response
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.exceptions import BadRequestError
from app.models.user import User
from app.rate_limit import limit_export
from app.services import export_service, resume_service, template_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/resumes", tags=["export"])


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


@router.get("/{resume_id}/export/{format}", dependencies=[Depends(limit_export)])
async def export_resume(
    resume_id: int,
    format_: str = Path(alias="format"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    """Download the resume as an ATS-friendly file in the requested format."""
    fmt = export_service.EXPORT_FORMATS.get(format_)
    if fmt is None:
        supported = ", ".join(export_service.EXPORT_FORMATS)
        raise BadRequestError(f"Unsupported export format. Supported formats: {supported}.")
    document = _load_document(db, user, resume_id)
    content = await run_in_threadpool(fmt.render, document)
    logger.info("Exported resume %s as %s (%d bytes)", resume_id, fmt.key, len(content))
    return Response(
        content=content,
        media_type=fmt.media_type,
        headers=_download_headers(document.title, fmt.key),
    )
