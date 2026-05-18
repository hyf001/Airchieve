"""d group book player reading

Revision ID: 20260518_0003
Revises: 20260517_0002
Create Date: 2026-05-18
"""

from alembic import op
import sqlalchemy as sa


revision = "20260518_0003"
down_revision = "20260517_0002"
branch_labels = None
depends_on = None

book_content_status_enum = sa.Enum("VISIBLE", "HIDDEN", name="bookcontentstatus")


def upgrade() -> None:
    op.add_column("books", sa.Column("source_type", sa.Enum("SYSTEM", "GENERATED", "TEMPLATE_RESULT", "ADMIN", name="booksourcetype"), nullable=False, server_default="SYSTEM"))
    op.add_column("books", sa.Column("custom_art_style_prompt", sa.Text(), nullable=True))
    op.add_column("books", sa.Column("default_voice_id", sa.Integer(), nullable=True))
    op.add_column("books", sa.Column("default_voice_name", sa.String(length=120), nullable=True))
    op.add_column("books", sa.Column("moderation_status", sa.Enum("PENDING", "APPROVED", "REJECTED", "HIDDEN", name="bookmoderationstatus"), nullable=False, server_default="APPROVED"))
    op.add_column("books", sa.Column("preview_page_count", sa.Integer(), nullable=False, server_default="3"))
    op.create_index(op.f("ix_books_source_type"), "books", ["source_type"], unique=False)
    op.create_index(op.f("ix_books_moderation_status"), "books", ["moderation_status"], unique=False)

    op.create_table(
        "book_pages",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("book_id", sa.Integer(), nullable=False),
        sa.Column("page_no", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=True),
        sa.Column("text_zh", sa.Text(), nullable=True),
        sa.Column("text_en", sa.Text(), nullable=True),
        sa.Column("narration_text", sa.Text(), nullable=True),
        sa.Column("visual_prompt", sa.Text(), nullable=True),
        sa.Column("image_asset_id", sa.Integer(), nullable=True),
        sa.Column("image_url", sa.String(length=500), nullable=True),
        sa.Column("video_asset_id", sa.Integer(), nullable=True),
        sa.Column("video_url", sa.String(length=500), nullable=True),
        sa.Column("audio_asset_id", sa.Integer(), nullable=True),
        sa.Column("audio_url", sa.String(length=500), nullable=True),
        sa.Column("background_music_asset_id", sa.Integer(), nullable=True),
        sa.Column("background_music_url", sa.String(length=500), nullable=True),
        sa.Column("sound_effect_asset_ids", sa.JSON(), nullable=False),
        sa.Column("sound_effect_urls", sa.JSON(), nullable=False),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("lip_sync_status", sa.Enum("NONE", "PENDING", "READY", "FAILED", name="booklipsyncstatus"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("book_id", "page_no", name="uq_book_pages_book_page_no"),
    )
    op.create_index(op.f("ix_book_pages_book_id"), "book_pages", ["book_id"], unique=False)

    op.create_table(
        "book_dialogues",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("page_id", sa.Integer(), nullable=False),
        sa.Column("character_ref", sa.String(length=120), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("audio_asset_id", sa.Integer(), nullable=True),
        sa.Column("audio_url", sa.String(length=500), nullable=True),
        sa.Column("start_ms", sa.Integer(), nullable=True),
        sa.Column("end_ms", sa.Integer(), nullable=True),
        sa.Column("lip_sync_asset_id", sa.Integer(), nullable=True),
        sa.Column("lip_sync_url", sa.String(length=500), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["page_id"], ["book_pages.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_book_dialogues_page_id"), "book_dialogues", ["page_id"], unique=False)

    op.create_table(
        "book_reading_prompts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("book_id", sa.Integer(), nullable=False),
        sa.Column("prompt_type", sa.Enum("QUESTION", "INTERACTION", name="bookprompttype"), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("page_no", sa.Integer(), nullable=True),
        sa.Column("status", book_content_status_enum, nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_book_reading_prompts_book_id"), "book_reading_prompts", ["book_id"], unique=False)
    op.create_index(op.f("ix_book_reading_prompts_status"), "book_reading_prompts", ["status"], unique=False)

    op.create_table(
        "book_learning_cards",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("book_id", sa.Integer(), nullable=False),
        sa.Column("theme", sa.String(length=120), nullable=True),
        sa.Column("education_goals", sa.JSON(), nullable=False),
        sa.Column("vocabulary", sa.JSON(), nullable=False),
        sa.Column("discussion_questions", sa.JSON(), nullable=False),
        sa.Column("status", book_content_status_enum, nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_book_learning_cards_book_id"), "book_learning_cards", ["book_id"], unique=False)
    op.create_index(op.f("ix_book_learning_cards_status"), "book_learning_cards", ["status"], unique=False)

    op.create_table(
        "reading_progress",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("child_profile_id", sa.Integer(), nullable=True),
        sa.Column("book_id", sa.Integer(), nullable=False),
        sa.Column("current_page_no", sa.Integer(), nullable=False),
        sa.Column("current_position_ms", sa.Integer(), nullable=False),
        sa.Column("progress_percent", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("mode", sa.Enum("AUTO", "MANUAL", "PARENT_CHILD", name="readingmode"), nullable=False),
        sa.Column("text_mode", sa.Enum("ZH", "EN", "BILINGUAL", name="readingtextmode"), nullable=False),
        sa.Column("voice_id", sa.Integer(), nullable=True),
        sa.Column("last_read_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "child_profile_id", "book_id", name="uq_reading_progress_scope"),
    )
    op.create_index(op.f("ix_reading_progress_book_id"), "reading_progress", ["book_id"], unique=False)
    op.create_index(op.f("ix_reading_progress_child_profile_id"), "reading_progress", ["child_profile_id"], unique=False)
    op.create_index(op.f("ix_reading_progress_last_read_at"), "reading_progress", ["last_read_at"], unique=False)
    op.create_index(op.f("ix_reading_progress_user_id"), "reading_progress", ["user_id"], unique=False)

    op.create_table(
        "reading_favorites",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("child_profile_id", sa.Integer(), nullable=True),
        sa.Column("book_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.Enum("ACTIVE", "DELETED", name="readingfavoritestatus"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "child_profile_id", "book_id", name="uq_reading_favorites_scope"),
    )
    op.create_index(op.f("ix_reading_favorites_book_id"), "reading_favorites", ["book_id"], unique=False)
    op.create_index(op.f("ix_reading_favorites_child_profile_id"), "reading_favorites", ["child_profile_id"], unique=False)
    op.create_index(op.f("ix_reading_favorites_status"), "reading_favorites", ["status"], unique=False)
    op.create_index(op.f("ix_reading_favorites_user_id"), "reading_favorites", ["user_id"], unique=False)

    op.create_table(
        "reading_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("child_profile_id", sa.Integer(), nullable=True),
        sa.Column("book_id", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.Enum("PLAY_START", "PAGE_VIEW", "PAUSE", "RESUME", "COMPLETE", "REPLAY", name="readingeventtype"), nullable=False),
        sa.Column("page_no", sa.Integer(), nullable=True),
        sa.Column("position_ms", sa.Integer(), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_reading_events_book_id"), "reading_events", ["book_id"], unique=False)
    op.create_index(op.f("ix_reading_events_event_type"), "reading_events", ["event_type"], unique=False)
    op.create_index(op.f("ix_reading_events_occurred_at"), "reading_events", ["occurred_at"], unique=False)
    op.create_index(op.f("ix_reading_events_user_id"), "reading_events", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_table("reading_events")
    op.drop_table("reading_favorites")
    op.drop_table("reading_progress")
    op.drop_table("book_learning_cards")
    op.drop_table("book_reading_prompts")
    op.drop_table("book_dialogues")
    op.drop_table("book_pages")
    op.drop_index(op.f("ix_books_moderation_status"), table_name="books")
    op.drop_index(op.f("ix_books_source_type"), table_name="books")
    op.drop_column("books", "preview_page_count")
    op.drop_column("books", "moderation_status")
    op.drop_column("books", "default_voice_name")
    op.drop_column("books", "default_voice_id")
    op.drop_column("books", "custom_art_style_prompt")
    op.drop_column("books", "source_type")
