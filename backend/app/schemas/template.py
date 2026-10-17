"""Template schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TemplateResponse(BaseModel):
    """Resume template as returned by the API (matches frontend `Template`)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    description: str | None = None
    font_family: str
    accent_color: str
    is_active: bool
    created_at: datetime
