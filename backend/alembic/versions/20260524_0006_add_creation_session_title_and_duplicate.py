"""add creation session title and duplicate source

Revision ID: 20260524_0006
Revises: 20260524_0005
Create Date: 2026-05-24

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260524_0006"
down_revision: str | Sequence[str] | None = "20260524_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = (
        {column["name"] for column in inspector.get_columns("creation_sessions")}
        if inspector.has_table("creation_sessions")
        else set()
    )
    if "title_snapshot" not in columns:
        op.add_column("creation_sessions", sa.Column("title_snapshot", sa.String(length=160), nullable=True))
    if "duplicated_from_session_id" not in columns:
        op.add_column("creation_sessions", sa.Column("duplicated_from_session_id", sa.Integer(), nullable=True))
        op.create_index(
            "ix_creation_sessions_duplicated_from_session_id",
            "creation_sessions",
            ["duplicated_from_session_id"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = (
        {column["name"] for column in inspector.get_columns("creation_sessions")}
        if inspector.has_table("creation_sessions")
        else set()
    )
    indexes = (
        {index["name"] for index in inspector.get_indexes("creation_sessions")}
        if inspector.has_table("creation_sessions")
        else set()
    )
    if "ix_creation_sessions_duplicated_from_session_id" in indexes:
        op.drop_index("ix_creation_sessions_duplicated_from_session_id", table_name="creation_sessions")
    if "duplicated_from_session_id" in columns:
        op.drop_column("creation_sessions", "duplicated_from_session_id")
    if "title_snapshot" in columns:
        op.drop_column("creation_sessions", "title_snapshot")
