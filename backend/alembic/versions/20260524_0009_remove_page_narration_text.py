"""remove page narration text columns

Revision ID: 20260524_0009
Revises: 20260524_0008
Create Date: 2026-05-24

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260524_0009"
down_revision: str | Sequence[str] | None = "20260524_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _columns(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table(table_name):
        return set()
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    if "narration_text" in _columns("creation_page_drafts"):
        op.drop_column("creation_page_drafts", "narration_text")
    if "narration_text" in _columns("book_pages"):
        op.drop_column("book_pages", "narration_text")


def downgrade() -> None:
    if "narration_text" not in _columns("creation_page_drafts"):
        op.add_column("creation_page_drafts", sa.Column("narration_text", sa.Text(), nullable=True))
    if "narration_text" not in _columns("book_pages"):
        op.add_column("book_pages", sa.Column("narration_text", sa.Text(), nullable=True))
