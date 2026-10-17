"""Initial schema: users, refresh_tokens, templates, resumes, resume_sections.

Revision ID: 0001_initial
Revises:
Create Date: 2026-10-12
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

section_type = postgresql.ENUM(
    "experience", "education", "project", "certification", name="section_type", create_type=False
)


def _ts() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    ]


def upgrade() -> None:
    section_type.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=True),
        sa.Column("full_name", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("is_verified", sa.Boolean(), nullable=False),
        sa.Column("oauth_provider", sa.String(50), nullable=True),
        *_ts(),
    )
    op.create_index("ix_users_id", "users", ["id"])
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "templates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("font_family", sa.String(100), nullable=False),
        sa.Column("accent_color", sa.String(20), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        *_ts(),
    )
    op.create_index("ix_templates_id", "templates", ["id"])
    op.create_index("ix_templates_slug", "templates", ["slug"], unique=True)

    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token", sa.String(512), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_refresh_tokens_id", "refresh_tokens", ["id"])
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    op.create_index("ix_refresh_tokens_token", "refresh_tokens", ["token"], unique=True)

    op.create_table(
        "resumes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("template_id", sa.Integer(), sa.ForeignKey("templates.id"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("full_name", sa.String(100), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("location", sa.String(150), nullable=True),
        sa.Column("linkedin_url", sa.String(500), nullable=True),
        sa.Column("website_url", sa.String(500), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("skills", postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column("ats_score", sa.Integer(), nullable=True),
        *_ts(),
    )
    op.create_index("ix_resumes_id", "resumes", ["id"])
    op.create_index("ix_resumes_user_id", "resumes", ["user_id"])
    op.create_index("ix_resumes_template_id", "resumes", ["template_id"])

    op.create_table(
        "resume_sections",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("resume_id", sa.Integer(), sa.ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", section_type, nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("organization", sa.String(200), nullable=True),
        sa.Column("location", sa.String(150), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("bullets", postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        *_ts(),
    )
    op.create_index("ix_resume_sections_id", "resume_sections", ["id"])
    op.create_index("ix_resume_sections_resume_id", "resume_sections", ["resume_id"])


def downgrade() -> None:
    op.drop_table("resume_sections")
    op.drop_table("resumes")
    op.drop_table("refresh_tokens")
    op.drop_table("templates")
    op.drop_table("users")
    section_type.drop(op.get_bind(), checkfirst=True)
