"""reading null profile unique indexes

Revision ID: 20260518_0004
Revises: 20260518_0003
Create Date: 2026-05-18
"""

from alembic import op
import sqlalchemy as sa


revision = "20260518_0004"
down_revision = "20260518_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "uq_reading_progress_user_book_no_profile",
        "reading_progress",
        ["user_id", "book_id"],
        unique=True,
        sqlite_where=sa.text("child_profile_id IS NULL"),
        postgresql_where=sa.text("child_profile_id IS NULL"),
    )
    op.create_index(
        "uq_reading_favorites_user_book_no_profile",
        "reading_favorites",
        ["user_id", "book_id"],
        unique=True,
        sqlite_where=sa.text("child_profile_id IS NULL"),
        postgresql_where=sa.text("child_profile_id IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_reading_favorites_user_book_no_profile", table_name="reading_favorites")
    op.drop_index("uq_reading_progress_user_book_no_profile", table_name="reading_progress")
