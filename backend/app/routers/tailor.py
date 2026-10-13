"""Job-description tailoring endpoint. Read-only: nothing is persisted or applied."""

from typing import cast

from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.exceptions import BadRequestError
from app.models.user import User
from app.schemas.tailor import TailorRequest, TailorResponse
from app.services import resume_service, tailor_service

router = APIRouter(prefix="/api/resumes", tags=["tailor"])


@router.post("/{resume_id}/tailor", response_model=TailorResponse)
async def tailor_resume(
    resume_id: int,
    payload: TailorRequest | None = Body(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TailorResponse:
    """Compare the resume with a job description (request body, else the stored one)."""
    resume = resume_service.get_owned_resume(db, cast(int, user.id), resume_id)
    body = payload or TailorRequest()
    job_description = body.job_description or cast(str | None, resume.job_description)
    if not job_description or not job_description.strip():
        raise BadRequestError("Add a job description first")
    job_title = body.job_title or cast(str | None, resume.job_title)
    return tailor_service.analyze(resume, job_description, job_title)
