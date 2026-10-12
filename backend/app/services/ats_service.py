"""Rule-based ATS compatibility check."""

import logging
from typing import cast

from sqlalchemy.orm import Session

from app.models.resume import Resume
from app.models.resume_section import SectionType
from app.schemas.resume import AtsCheckResponse

logger = logging.getLogger(__name__)

MAX_BULLET_CHARS = 200
MIN_BULLETS_PER_EXPERIENCE = 2
MIN_SKILLS = 5
MIN_SUMMARY_CHARS = 50


def _blank(value: str | None) -> bool:
    return value is None or not value.strip()


def evaluate_resume(resume: Resume) -> AtsCheckResponse:
    """Score a resume (0-100) and list actionable suggestions. Pure function, no I/O."""
    score = 100
    suggestions: list[str] = []

    def penalize(points: int, message: str) -> None:
        nonlocal score
        score -= points
        suggestions.append(message)

    # Contact info
    for attr, label, points in (
        ("full_name", "full name", 8),
        ("email", "email address", 8),
        ("phone", "phone number", 6),
        ("location", "location (city, country)", 6),
    ):
        if _blank(cast(str | None, getattr(resume, attr))):
            penalize(points, f"Add your {label} so recruiters and ATS can contact you.")
    if _blank(cast(str | None, resume.linkedin_url)):
        penalize(3, "Add your LinkedIn profile URL.")

    # Summary
    if _blank(cast(str | None, resume.summary)):
        penalize(8, "Add a professional summary at the top of your resume.")
    elif len((cast(str | None, resume.summary) or "").strip()) < MIN_SUMMARY_CHARS:
        penalize(3, "Expand your summary to at least a couple of sentences.")

    sections = list(resume.sections)
    experiences = [s for s in sections if s.type == SectionType.experience]
    educations = [s for s in sections if s.type == SectionType.education]

    if not experiences:
        penalize(15, "Add at least one work experience section.")
    if not educations:
        penalize(8, "Add an education section.")

    # Dates
    undated = [s for s in experiences + educations if s.start_date is None]
    if undated:
        names = ", ".join(f'"{s.title}"' for s in undated[:5])
        penalize(min(10, 4 * len(undated)), f"Add start dates to: {names}.")

    # Bullets
    empty_bullets = 0
    long_bullets = 0
    for sec in sections:
        for bullet in sec.bullets or []:
            if not bullet.strip():
                empty_bullets += 1
            elif len(bullet) > MAX_BULLET_CHARS:
                long_bullets += 1
    if empty_bullets:
        penalize(min(6, 2 * empty_bullets), f"Remove {empty_bullets} empty bullet point(s).")
    if long_bullets:
        penalize(
            min(8, 2 * long_bullets),
            f"Shorten {long_bullets} bullet(s) longer than {MAX_BULLET_CHARS} characters.",
        )
    sparse = [
        s
        for s in experiences
        if sum(1 for b in (s.bullets or []) if b.strip()) < MIN_BULLETS_PER_EXPERIENCE
    ]
    if sparse:
        names = ", ".join(f'"{s.title}"' for s in sparse[:5])
        penalize(
            min(10, 4 * len(sparse)),
            f"Add at least {MIN_BULLETS_PER_EXPERIENCE} achievement bullets to each "
            f"experience: {names}.",
        )

    # Skills
    skills = [s for s in (cast(list[str] | None, resume.skills) or []) if s.strip()]
    if not skills:
        penalize(10, "Add a skills list with keywords relevant to your target role.")
    elif len(skills) < MIN_SKILLS:
        penalize(5, f"List at least {MIN_SKILLS} skills to improve keyword coverage.")

    return AtsCheckResponse(score=max(0, min(100, score)), suggestions=suggestions)


def run_ats_check(db: Session, resume: Resume) -> AtsCheckResponse:
    """Evaluate the resume and persist ats_score. Caller must have verified ownership."""
    result = evaluate_resume(resume)
    resume.ats_score = result.score  # type: ignore[assignment]
    db.commit()
    logger.info("ATS check for resume %s scored %s", resume.id, result.score)
    return result
