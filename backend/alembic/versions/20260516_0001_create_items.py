"""create items table

Revision ID: 20260516_0001
Revises:
Create Date: 2026-05-16 12:00:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260516_0001"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "items",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.String(length=1024), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_items_name"), "items", ["name"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_items_name"), table_name="items")
    op.drop_table("items")

