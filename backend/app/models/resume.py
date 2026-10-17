"""Resume model."""

from sqlalchemy import JSON, Column, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin

# ARRAY(String) on PostgreSQL, JSON elsewhere (e.g. SQLite in tests).
StringList = ARRAY(String).with_variant(JSON(), "sqlite")


class Resume(Base, TimestampMixin):
    __tablename__ = "resumes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    template_id = Column(Integer, ForeignKey("templates.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    full_name = Column(String(100), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    location = Column(String(150), nullable=True)
    linkedin_url = Column(String(500), nullable=True)
    website_url = Column(String(500), nullable=True)
    summary = Column(Text, nullable=True)
    skills: Column[list[str]] = Column(StringList, nullable=False, default=list)
    ats_score = Column(Integer, nullable=True)

    user = relationship("User", back_populates="resumes")
    template = relationship("Template", back_populates="resumes")
    sections = relationship(
        "ResumeSection",
        back_populates="resume",
        cascade="all, delete-orphan",
        order_by="ResumeSection.position",
    )
