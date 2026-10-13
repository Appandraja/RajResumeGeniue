"""Resume and section business logic. Every query is scoped to the owning user."""

import logging
from typing import Any, cast

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.exceptions import BadRequestError, NotFoundError
from app.models.resume import Resume
from app.models.resume_section import ResumeSection
from app.models.template import Template
from app.schemas.resume import (
    MAX_SECTIONS,
    ResumeCreate,
    ResumeUpdate,
    SectionCreate,
    SectionUpdate,
)

logger = logging.getLogger(__name__)

_RESUME_FIELDS = (
    "full_name",
    "email",
    "phone",
    "location",
    "linkedin_url",
    "website_url",
    "summary",
    "job_title",
    "company",
    "job_description",
)


def _ensure_active_template(db: Session, template_id: int) -> None:
    found = db.execute(
        select(Template.id).where(Template.id == template_id, Template.is_active.is_(True))
    ).scalar_one_or_none()
    if found is None:
        raise BadRequestError("Template does not exist or is not active")


def get_owned_resume(db: Session, user_id: int, resume_id: int) -> Resume:
    """Return the resume (sections eager-loaded, ordered by position) owned by user_id.

    Raises NotFoundError (404) if it does not exist or belongs to another user.
    """
    resume = db.execute(
        select(Resume)
        .where(Resume.id == resume_id, Resume.user_id == user_id)
        .options(selectinload(Resume.sections))
    ).scalar_one_or_none()
    if resume is None:
        raise NotFoundError("Resume")
    return resume


def list_resumes(db: Session, user_id: int) -> list[Resume]:
    return list(
        db.execute(
            select(Resume)
            .where(Resume.user_id == user_id)
            .options(selectinload(Resume.sections))
            .order_by(Resume.updated_at.desc(), Resume.id.desc())
        )
        .scalars()
        .all()
    )


def _clone_section(sec: SectionCreate | ResumeSection, position: int) -> ResumeSection:
    return ResumeSection(
        type=sec.type,
        title=sec.title,
        organization=sec.organization,
        location=sec.location,
        start_date=sec.start_date,
        end_date=sec.end_date,
        bullets=list(sec.bullets or []),
        position=position,
    )


def create_resume(db: Session, user_id: int, data: ResumeCreate) -> Resume:
    _ensure_active_template(db, data.template_id)
    resume = Resume(
        user_id=user_id,
        template_id=data.template_id,
        title=data.title,
        skills=list(data.skills),
        **{f: getattr(data, f) for f in _RESUME_FIELDS},
    )
    for index, sec in enumerate(data.sections):
        resume.sections.append(_clone_section(sec, index))
    db.add(resume)
    db.commit()
    logger.info("User %s created resume %s", user_id, resume.id)
    return get_owned_resume(db, user_id, cast(int, resume.id))


def update_resume(db: Session, user_id: int, resume_id: int, data: ResumeUpdate) -> Resume:
    resume = get_owned_resume(db, user_id, resume_id)
    changes: dict[str, Any] = data.model_dump(exclude_unset=True)
    if "template_id" in changes and changes["template_id"] != resume.template_id:
        _ensure_active_template(db, changes["template_id"])
    for key, value in changes.items():
        setattr(resume, key, value)
    db.commit()
    return get_owned_resume(db, user_id, resume_id)


def delete_resume(db: Session, user_id: int, resume_id: int) -> None:
    resume = get_owned_resume(db, user_id, resume_id)
    db.delete(resume)
    db.commit()
    logger.info("User %s deleted resume %s", user_id, resume_id)


def duplicate_resume(db: Session, user_id: int, resume_id: int) -> Resume:
    source = get_owned_resume(db, user_id, resume_id)
    copy = Resume(
        user_id=user_id,
        template_id=source.template_id,
        title=f"{source.title} (copy)"[:200],
        skills=list(source.skills or []),
        **{f: getattr(source, f) for f in _RESUME_FIELDS},
    )
    for sec in source.sections:
        copy.sections.append(_clone_section(sec, sec.position))
    db.add(copy)
    db.commit()
    logger.info("User %s duplicated resume %s -> %s", user_id, resume_id, copy.id)
    return get_owned_resume(db, user_id, cast(int, copy.id))


# ---------------------------------------------------------------- sections


def _get_section(resume: Resume, section_id: int) -> ResumeSection:
    for sec in resume.sections:
        if sec.id == section_id:
            return sec
    raise NotFoundError("Section")


def _renumber(ordered: list[ResumeSection]) -> None:
    for index, sec in enumerate(ordered):
        sec.position = index  # type: ignore[assignment]


def add_section(db: Session, user_id: int, resume_id: int, data: SectionCreate) -> ResumeSection:
    resume = get_owned_resume(db, user_id, resume_id)
    if len(resume.sections) >= MAX_SECTIONS:
        raise BadRequestError(f"A resume can have at most {MAX_SECTIONS} sections")
    section = _clone_section(data, 0)
    ordered = list(resume.sections)  # already sorted by position
    index = len(ordered) if data.position is None else min(data.position, len(ordered))
    ordered.insert(index, section)
    resume.sections.append(section)
    _renumber(ordered)
    db.commit()
    db.refresh(section)
    return section


def update_section(
    db: Session, user_id: int, resume_id: int, section_id: int, data: SectionUpdate
) -> ResumeSection:
    resume = get_owned_resume(db, user_id, resume_id)
    section = _get_section(resume, section_id)
    changes: dict[str, Any] = data.model_dump(exclude_unset=True)
    new_position = changes.pop("position", None)
    for key, value in changes.items():
        setattr(section, key, value)
    if section.start_date and section.end_date and section.end_date < section.start_date:
        db.rollback()
        raise BadRequestError("end_date must not be before start_date")
    if new_position is not None:
        ordered = [s for s in resume.sections if s.id != section.id]
        ordered.insert(min(new_position, len(ordered)), section)
        _renumber(ordered)
    db.commit()
    db.refresh(section)
    return section


def delete_section(db: Session, user_id: int, resume_id: int, section_id: int) -> None:
    resume = get_owned_resume(db, user_id, resume_id)
    section = _get_section(resume, section_id)
    remaining = [s for s in resume.sections if s.id != section.id]
    resume.sections.remove(section)
    db.delete(section)
    _renumber(remaining)
    db.commit()
