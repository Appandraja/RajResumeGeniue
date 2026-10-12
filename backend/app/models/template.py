"""Template model (ATS-safe resume layouts)."""

from sqlalchemy import Boolean, Column, Integer, String, Text
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin


class Template(Base, TimestampMixin):
    __tablename__ = "templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    font_family = Column(String(100), nullable=False)
    accent_color = Column(String(20), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    resumes = relationship("Resume", back_populates="template")
