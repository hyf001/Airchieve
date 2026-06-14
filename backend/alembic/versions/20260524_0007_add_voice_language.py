"""add voice language

Revision ID: 20260524_0007
Revises: 20260524_0006
Create Date: 2026-05-24

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260524_0007"
down_revision: str | Sequence[str] | None = "20260524_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


voices = sa.table(
    "voices",
    sa.column("voice_style_code", sa.String),
    sa.column("voice_language", sa.String),
)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("voices"):
        return
    columns = {column["name"] for column in inspector.get_columns("voices")}
    if "voice_language" not in columns:
        op.add_column("voices", sa.Column("voice_language", sa.String(length=16), nullable=True))

    bind.execute(
        voices.update()
        .where(voices.c.voice_style_code.like("%#zh"))
        .values(
            voice_style_code=sa.func.substr(voices.c.voice_style_code, 1, sa.func.length(voices.c.voice_style_code) - 3),
            voice_language="zh",
        )
    )
    bind.execute(
        voices.update()
        .where(voices.c.voice_style_code.like("%#en"))
        .values(
            voice_style_code=sa.func.substr(voices.c.voice_style_code, 1, sa.func.length(voices.c.voice_style_code) - 3),
            voice_language="en",
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("voices"):
        return
    columns = {column["name"] for column in inspector.get_columns("voices")}
    if "voice_language" in columns:
        op.drop_column("voices", "voice_language")
