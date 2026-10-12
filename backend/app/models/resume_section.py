"""ResumeSection model."""

import enum

from sqlalchemy import Column, Date, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin
from app.models.resume import StringList


class SectionType(enum.StrEnum):
    experience = "experience"
    education = "education"
    project = "project"
    certification = "certification"


class ResumeSection(Base, TimestampMixin):
    __tablename__ = "resume_sections"

    id = Column(Integer, primary_key=True, index=True)
    resume_id = Column(
        Integer, ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    type: Column[SectionType] = Column(Enum(SectionType, name="section_type"), nullable=False)
    title = Column(String(200), nullable=False)
    organization = Column(String(200), nullable=True)
    location = Column(String(150), nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)  # NULL = current
    bullets: Column[list[str]] = Column(StringList, nullable=False, default=list)
    position = Column(Integer, nullable=False, default=0)

    resume = relationship("Resume", back_populates="sections")
