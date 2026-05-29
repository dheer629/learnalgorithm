"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-05-30
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "categories",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("slug", sa.String(length=120), nullable=False, unique=True),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
    )
    op.create_index("ix_categories_slug", "categories", ["slug"])
    op.create_index("ix_categories_name", "categories", ["name"])
    op.create_table(
        "algorithms",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("slug", sa.String(length=220), nullable=False, unique=True),
        sa.Column("name", sa.String(length=220), nullable=False),
        sa.Column("category_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("categories.id"), nullable=False),
        sa.Column("source_path", sa.String(length=500), nullable=False, unique=True),
        sa.Column("source_url", sa.String(length=800), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("source_code", sa.Text(), nullable=False),
        sa.Column("functions", postgresql.JSONB(), nullable=False),
        sa.Column("doctests", postgresql.ARRAY(sa.Text()), nullable=False),
        sa.Column("complexity", postgresql.JSONB(), nullable=False),
        sa.Column("tags", postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column("difficulty", sa.String(length=40), nullable=False),
        sa.Column("search_vector", postgresql.TSVECTOR(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_algorithms_slug", "algorithms", ["slug"])
    op.create_index("ix_algorithms_name", "algorithms", ["name"])
    op.create_index("ix_algorithms_search_vector", "algorithms", ["search_vector"], postgresql_using="gin")
    op.create_table(
        "user_progress",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("user_id", sa.String(length=160), nullable=False),
        sa.Column("algorithm_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("algorithms.id"), nullable=False),
        sa.Column("state", sa.String(length=40), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "algorithm_id", name="uq_progress_user_algorithm"),
    )
    op.create_index("ix_user_progress_user_id", "user_progress", ["user_id"])


def downgrade() -> None:
    op.drop_table("user_progress")
    op.drop_table("algorithms")
    op.drop_table("categories")

