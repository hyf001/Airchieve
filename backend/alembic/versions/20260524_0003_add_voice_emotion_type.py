"""add voice emotion type

Revision ID: 20260524_0003
Revises: 20260522_0002
Create Date: 2026-05-24

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260524_0003"
down_revision: str | Sequence[str] | None = "20260522_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("voices")} if inspector.has_table("voices") else set()
    if "emotion_type" not in columns:
        op.add_column("voices", sa.Column("emotion_type", sa.String(length=64), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("voices")} if inspector.has_table("voices") else set()
    if "emotion_type" in columns:
        op.drop_column("voices", "emotion_type")
