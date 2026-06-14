"""remove voice style taxonomy seed

Revision ID: 20260524_0008
Revises: 20260524_0007
Create Date: 2026-05-24

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260524_0008"
down_revision: str | Sequence[str] | None = "20260524_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


taxonomy_items = sa.table(
    "taxonomy_items",
    sa.column("type", sa.String),
)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("taxonomy_items"):
        return
    bind.execute(taxonomy_items.delete().where(taxonomy_items.c.type == "voice_style"))


def downgrade() -> None:
    pass
