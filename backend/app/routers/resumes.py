"""Resume endpoints. All routes require authentication and are user-scoped."""

from typing import cast

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.resume import (
    AtsCheckResponse,
    ResumeCreate,
    ResumeResponse,
    ResumeUpdate,
    SectionCreate,
    SectionResponse,
    SectionUpdate,
)
from app.services import ats_service, resume_service

router = APIRouter(prefix="/api/resumes", tags=["resumes"])


def _uid(user: User) -> int:
    return cast(int, user.id)


@router.get("", response_model=list[ResumeResponse])
async def list_resumes(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[ResumeResponse]:
    resumes = resume_service.list_resumes(db, _uid(user))
    return [ResumeResponse.model_validate(r) for r in resumes]


@router.post("", response_model=ResumeResponse, status_code=status.HTTP_201_CREATED)
async def create_resume(
    payload: ResumeCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> ResumeResponse:
    return ResumeResponse.model_validate(resume_service.create_resume(db, _uid(user), payload))


@router.get("/{resume_id}", response_model=ResumeResponse)
async def get_resume(
    resume_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> ResumeResponse:
    return ResumeResponse.model_validate(resume_service.get_owned_resume(db, _uid(user), resume_id))


@router.put("/{resume_id}", response_model=ResumeResponse)
async def update_resume(
    resume_id: int,
    payload: ResumeUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ResumeResponse:
    return ResumeResponse.model_validate(
        resume_service.update_resume(db, _uid(user), resume_id, payload)
    )


@router.delete("/{resume_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resume(
    resume_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> Response:
    resume_service.delete_resume(db, _uid(user), resume_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{resume_id}/duplicate", response_model=ResumeResponse, status_code=status.HTTP_201_CREATED
)
async def duplicate_resume(
    resume_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> ResumeResponse:
    return ResumeResponse.model_validate(resume_service.duplicate_resume(db, _uid(user), resume_id))


@router.post(
    "/{resume_id}/sections", response_model=SectionResponse, status_code=status.HTTP_201_CREATED
)
async def add_section(
    resume_id: int,
    payload: SectionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SectionResponse:
    return SectionResponse.model_validate(
        resume_service.add_section(db, _uid(user), resume_id, payload)
    )


@router.put("/{resume_id}/sections/{section_id}", response_model=SectionResponse)
async def update_section(
    resume_id: int,
    section_id: int,
    payload: SectionUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SectionResponse:
    return SectionResponse.model_validate(
        resume_service.update_section(db, _uid(user), resume_id, section_id, payload)
    )


@router.delete("/{resume_id}/sections/{section_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_section(
    resume_id: int,
    section_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    resume_service.delete_section(db, _uid(user), resume_id, section_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{resume_id}/ats-check", response_model=AtsCheckResponse)
async def ats_check(
    resume_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> AtsCheckResponse:
    resume = resume_service.get_owned_resume(db, _uid(user), resume_id)
    return ats_service.run_ats_check(db, resume)
