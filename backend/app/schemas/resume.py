"""Pydantic schemas for the resumes module (field names match frontend types)."""

from datetime import date, datetime
from typing import Annotated, Self
from urllib.parse import urlparse

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

from app.models.resume_section import SectionType

MAX_SECTIONS = 20
MAX_BULLETS = 15
MAX_BULLET_LENGTH = 500
MAX_SKILLS = 50
MAX_SKILL_LENGTH = 60
MAX_JOB_DESCRIPTION = 20_000

Bullet = Annotated[str, StringConstraints(strip_whitespace=True, max_length=MAX_BULLET_LENGTH)]
Skill = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_SKILL_LENGTH)
]


def _blank_to_none(value: object) -> object:
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


def _check_http_url(value: str | None) -> str | None:
    if value is None:
        return None
    parsed = urlparse(value)
    if parsed.scheme not in ("http", "https") or not parsed.netloc or " " in value:
        raise ValueError("Must be a valid http(s) URL")
    return value


def _check_date_order(start: date | None, end: date | None) -> None:
    if start is not None and end is not None and end < start:
        raise ValueError("end_date must not be before start_date")


def _strip(value: object) -> object:
    return value.strip() if isinstance(value, str) else value


class ResumeBase(BaseModel):
    full_name: str | None = Field(default=None, max_length=100)
    email: EmailStr | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    location: str | None = Field(default=None, max_length=150)
    linkedin_url: str | None = Field(default=None, max_length=500)
    website_url: str | None = Field(default=None, max_length=500)
    summary: str | None = Field(default=None, max_length=3000)
    job_title: str | None = Field(default=None, max_length=200)
    company: str | None = Field(default=None, max_length=200)
    job_description: str | None = Field(default=None, max_length=MAX_JOB_DESCRIPTION)

    @field_validator(
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
        mode="before",
    )
    @classmethod
    def _normalize_blank(cls, value: object) -> object:
        return _blank_to_none(value)

    @field_validator("linkedin_url", "website_url")
    @classmethod
    def _validate_url(cls, value: str | None) -> str | None:
        return _check_http_url(value)

    @field_validator("phone")
    @classmethod
    def _validate_phone(cls, value: str | None) -> str | None:
        if value is not None and sum(ch.isdigit() for ch in value) < 7:
            raise ValueError("Phone number must contain at least 7 digits")
        return value


class SectionCreate(BaseModel):
    type: SectionType
    title: str = Field(min_length=1, max_length=200)
    organization: str | None = Field(default=None, max_length=200)
    location: str | None = Field(default=None, max_length=150)
    start_date: date | None = None
    end_date: date | None = None
    bullets: list[Bullet] = Field(default_factory=list, max_length=MAX_BULLETS)
    position: int | None = Field(default=None, ge=0, le=1000)

    @field_validator("title", mode="before")
    @classmethod
    def _strip_title(cls, value: object) -> object:
        return _strip(value)

    @field_validator("organization", "location", mode="before")
    @classmethod
    def _blank_optional(cls, value: object) -> object:
        return _blank_to_none(value)

    @model_validator(mode="after")
    def _dates(self) -> Self:
        _check_date_order(self.start_date, self.end_date)
        return self


class SectionUpdate(BaseModel):
    type: SectionType | None = None
    title: str | None = Field(default=None, min_length=1, max_length=200)
    organization: str | None = Field(default=None, max_length=200)
    location: str | None = Field(default=None, max_length=150)
    start_date: date | None = None
    end_date: date | None = None
    bullets: list[Bullet] | None = Field(default=None, max_length=MAX_BULLETS)
    position: int | None = Field(default=None, ge=0, le=1000)

    @field_validator("title", mode="before")
    @classmethod
    def _strip_title(cls, value: object) -> object:
        return _strip(value)

    @field_validator("organization", "location", mode="before")
    @classmethod
    def _blank_optional(cls, value: object) -> object:
        return _blank_to_none(value)

    @model_validator(mode="after")
    def _check(self) -> Self:
        for name in ("type", "title", "bullets"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} must not be null")
        _check_date_order(self.start_date, self.end_date)
        return self


class SectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    resume_id: int
    type: SectionType
    title: str
    organization: str | None
    location: str | None
    start_date: date | None
    end_date: date | None
    bullets: list[str]
    position: int
    created_at: datetime
    updated_at: datetime


class ResumeCreate(ResumeBase):
    template_id: int = Field(gt=0)
    title: str = Field(min_length=1, max_length=200)
    skills: list[Skill] = Field(default_factory=list, max_length=MAX_SKILLS)
    sections: list[SectionCreate] = Field(default_factory=list, max_length=MAX_SECTIONS)

    @field_validator("title", mode="before")
    @classmethod
    def _strip_title(cls, value: object) -> object:
        return _strip(value)


class ResumeUpdate(ResumeBase):
    template_id: int | None = Field(default=None, gt=0)
    title: str | None = Field(default=None, min_length=1, max_length=200)
    skills: list[Skill] | None = Field(default=None, max_length=MAX_SKILLS)

    @field_validator("title", mode="before")
    @classmethod
    def _strip_title(cls, value: object) -> object:
        return _strip(value)

    @model_validator(mode="after")
    def _not_null_fields(self) -> Self:
        for name in ("template_id", "title", "skills"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} must not be null")
        return self


class ResumeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    template_id: int
    title: str
    full_name: str | None
    email: str | None
    phone: str | None
    location: str | None
    linkedin_url: str | None
    website_url: str | None
    summary: str | None
    skills: list[str]
    ats_score: int | None
    job_title: str | None = None
    company: str | None = None
    job_description: str | None = None
    sections: list[SectionResponse]
    created_at: datetime
    updated_at: datetime

    @field_validator("sections", mode="after")
    @classmethod
    def _sort_sections(cls, value: list[SectionResponse]) -> list[SectionResponse]:
        return sorted(value, key=lambda s: (s.position, s.id))


class AtsCheckResponse(BaseModel):
    score: int = Field(ge=0, le=100)
    suggestions: list[str]
