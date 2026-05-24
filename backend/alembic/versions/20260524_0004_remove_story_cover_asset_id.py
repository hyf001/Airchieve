"""remove story cover asset id

Revision ID: 20260524_0004
Revises: 20260524_0003
Create Date: 2026-05-24

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260524_0004"
down_revision: str | Sequence[str] | None = "20260524_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("stories")} if inspector.has_table("stories") else set()
    if "cover_asset_id" in columns:
        op.drop_column("stories", "cover_asset_id")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("stories")} if inspector.has_table("stories") else set()
    if "cover_asset_id" not in columns:
        op.add_column("stories", sa.Column("cover_asset_id", sa.Integer(), nullable=True))
