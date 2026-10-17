"""Schemas for resume import (field names match frontend/src/types/importer.ts)."""

from typing import Literal

from pydantic import BaseModel, Field

ImportedSectionType = Literal["experience", "education", "project", "certification"]
ImportSourceFormat = Literal["pdf", "docx", "odt", "rtf", "txt", "md", "html"]


class ImportedSection(BaseModel):
    type: ImportedSectionType
    title: str
    organization: str | None = None
    location: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    bullets: list[str] = Field(default_factory=list)
    position: int = 0


class ImportedDraft(BaseModel):
    title: str
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    location: str | None = None
    linkedin_url: str | None = None
    website_url: str | None = None
    summary: str | None = None
    skills: list[str] = Field(default_factory=list)
    sections: list[ImportedSection] = Field(default_factory=list)


class ImportResult(BaseModel):
    draft: ImportedDraft
    warnings: list[str] = Field(default_factory=list)
    source_format: ImportSourceFormat
    char_count: int
