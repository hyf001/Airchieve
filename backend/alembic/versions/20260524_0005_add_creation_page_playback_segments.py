"""add creation page playback segments

Revision ID: 20260524_0005
Revises: 20260524_0004
Create Date: 2026-05-24

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260524_0005"
down_revision: str | Sequence[str] | None = "20260524_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = (
        {column["name"] for column in inspector.get_columns("creation_page_drafts")}
        if inspector.has_table("creation_page_drafts")
        else set()
    )
    if "playback_segments" not in columns:
        op.add_column(
            "creation_page_drafts",
            sa.Column("playback_segments", sa.JSON(), nullable=False, server_default="[]"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = (
        {column["name"] for column in inspector.get_columns("creation_page_drafts")}
        if inspector.has_table("creation_page_drafts")
        else set()
    )
    if "playback_segments" in columns:
        op.drop_column("creation_page_drafts", "playback_segments")
