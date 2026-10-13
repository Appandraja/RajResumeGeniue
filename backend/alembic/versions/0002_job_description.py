"""Add job description fields to resumes (job_title, company, job_description).

Revision ID: 0002_job_description
Revises: 0001_initial
Create Date: 2026-10-13
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0002_job_description"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("resumes", sa.Column("job_title", sa.String(200), nullable=True))
    op.add_column("resumes", sa.Column("company", sa.String(200), nullable=True))
    op.add_column("resumes", sa.Column("job_description", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("resumes", "job_description")
    op.drop_column("resumes", "company")
    op.drop_column("resumes", "job_title")
