"""Schemas for the job-description tailoring endpoint (match frontend/src/types/tailor.ts)."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.resume import MAX_JOB_DESCRIPTION, AtsCheckResponse

Importance = Literal["high", "medium", "low"]
ActionType = Literal["add_skill", "reorder_skills"]


class TailorRequest(BaseModel):
    job_description: str | None = Field(default=None, max_length=MAX_JOB_DESCRIPTION)
    job_title: str | None = Field(default=None, max_length=200)

    @field_validator("job_description", "job_title", mode="before")
    @classmethod
    def _blank_to_none(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip() or None
        return value


class MatchedKeyword(BaseModel):
    keyword: str
    importance: Importance
    where: list[str]


class MissingKeyword(BaseModel):
    keyword: str
    importance: Importance
    suggestion: str


class TailorAction(BaseModel):
    type: ActionType
    value: str | list[str]


class TailorSuggestion(BaseModel):
    code: str
    severity: Importance
    section: str | None
    message: str
    action: TailorAction | None = None


class TailorResponse(BaseModel):
    match_score: int = Field(ge=0, le=100)
    job_title: str | None
    matched: list[MatchedKeyword]
    missing: list[MissingKeyword]
    suggestions: list[TailorSuggestion]
    ats: AtsCheckResponse
