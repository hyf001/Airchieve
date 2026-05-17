"""c group discovery story recommendation

Revision ID: 20260517_0001
Revises:
Create Date: 2026-05-17
"""

from alembic import op
import sqlalchemy as sa


revision = "20260517_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "books",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("owner_user_id", sa.Integer(), nullable=True),
        sa.Column("source_story_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("subtitle", sa.String(length=240), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("cover_asset_id", sa.Integer(), nullable=True),
        sa.Column("cover_url", sa.String(length=500), nullable=True),
        sa.Column("age_range_ids", sa.JSON(), nullable=False),
        sa.Column("theme_ids", sa.JSON(), nullable=False),
        sa.Column("education_goal_ids", sa.JSON(), nullable=False),
        sa.Column("tags", sa.JSON(), nullable=False),
        sa.Column("language", sa.Enum("ZH", "EN", "BILINGUAL", name="booklanguage"), nullable=False),
        sa.Column("reading_level", sa.String(length=64), nullable=True),
        sa.Column("narrative_style_id", sa.Integer(), nullable=True),
        sa.Column("art_style_id", sa.Integer(), nullable=True),
        sa.Column("page_count", sa.Integer(), nullable=False),
        sa.Column("duration_seconds", sa.Integer(), nullable=False),
        sa.Column("access_level", sa.Enum("FREE", "PREVIEW", "VIP", name="bookaccesslevel"), nullable=False),
        sa.Column(
            "publish_status",
            sa.Enum("DRAFT", "PUBLISHED", "UNPUBLISHED", "DELETED", name="bookpublishstatus"),
            nullable=False,
        ),
        sa.Column("is_featured", sa.Boolean(), nullable=False),
        sa.Column("play_count", sa.Integer(), nullable=False),
        sa.Column("favorite_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_books_access_level"), "books", ["access_level"], unique=False)
    op.create_index(op.f("ix_books_is_featured"), "books", ["is_featured"], unique=False)
    op.create_index(op.f("ix_books_owner_user_id"), "books", ["owner_user_id"], unique=False)
    op.create_index(op.f("ix_books_publish_status"), "books", ["publish_status"], unique=False)
    op.create_index(op.f("ix_books_reading_level"), "books", ["reading_level"], unique=False)
    op.create_index(op.f("ix_books_source_story_id"), "books", ["source_story_id"], unique=False)
    op.create_index(op.f("ix_books_title"), "books", ["title"], unique=False)

    op.create_table(
        "stories",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("owner_user_id", sa.Integer(), nullable=True),
        sa.Column("source_type", sa.Enum("SYSTEM", "USER", "UPLOADED", "GENERATED_IDEA", name="storysourcetype"), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("cover_asset_id", sa.Integer(), nullable=True),
        sa.Column("cover_url", sa.String(length=500), nullable=True),
        sa.Column("age_range_ids", sa.JSON(), nullable=False),
        sa.Column("theme_ids", sa.JSON(), nullable=False),
        sa.Column("education_goal_ids", sa.JSON(), nullable=False),
        sa.Column("language", sa.Enum("ZH", "EN", "BILINGUAL", name="storylanguage"), nullable=False),
        sa.Column("narrative_style_id", sa.Integer(), nullable=True),
        sa.Column("access_level", sa.Enum("FREE", "PREVIEW", "VIP", name="storyaccesslevel"), nullable=False),
        sa.Column(
            "moderation_status",
            sa.Enum("PENDING", "APPROVED", "REJECTED", "HIDDEN", name="storymoderationstatus"),
            nullable=False,
        ),
        sa.Column(
            "publish_status",
            sa.Enum("DRAFT", "PUBLISHED", "UNPUBLISHED", "DELETED", name="storypublishstatus"),
            nullable=False,
        ),
        sa.Column("view_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_stories_access_level"), "stories", ["access_level"], unique=False)
    op.create_index(op.f("ix_stories_moderation_status"), "stories", ["moderation_status"], unique=False)
    op.create_index(op.f("ix_stories_owner_user_id"), "stories", ["owner_user_id"], unique=False)
    op.create_index(op.f("ix_stories_publish_status"), "stories", ["publish_status"], unique=False)
    op.create_index(op.f("ix_stories_source_type"), "stories", ["source_type"], unique=False)
    op.create_index(op.f("ix_stories_title"), "stories", ["title"], unique=False)

    op.create_table(
        "recommendation_slots",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("code", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column(
            "page",
            sa.Enum("HOME", "CATEGORY", "BOOK_DETAIL", "PLAYER_END", "CREATION_ENTRY", name="recommendationpage"),
            nullable=False,
        ),
        sa.Column(
            "display_type",
            sa.Enum("CAROUSEL", "GRID", "LIST", "TOPIC", name="recommendationdisplaytype"),
            nullable=False,
        ),
        sa.Column("rule_config", sa.JSON(), nullable=False),
        sa.Column("status", sa.Enum("ACTIVE", "INACTIVE", name="recommendationstatus"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_recommendation_slots_code"), "recommendation_slots", ["code"], unique=True)
    op.create_index(op.f("ix_recommendation_slots_page"), "recommendation_slots", ["page"], unique=False)
    op.create_index(op.f("ix_recommendation_slots_status"), "recommendation_slots", ["status"], unique=False)

    op.create_table(
        "recommendation_items",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("slot_id", sa.Integer(), nullable=False),
        sa.Column(
            "target_type",
            sa.Enum("BOOK", "STORY", "TEMPLATE", "ART_STYLE", "CHARACTER", "VOICE", "TOPIC", name="recommendationtargettype"),
            nullable=False,
        ),
        sa.Column("target_id", sa.Integer(), nullable=False),
        sa.Column("title_override", sa.String(length=160), nullable=True),
        sa.Column("image_asset_id_override", sa.String(length=120), nullable=True),
        sa.Column("scene_ids", sa.JSON(), nullable=False),
        sa.Column("min_age", sa.Integer(), nullable=True),
        sa.Column("max_age", sa.Integer(), nullable=True),
        sa.Column(
            "access_level_filter",
            sa.Enum("ALL", "FREE", "VIP", name="recommendationaccessfilter"),
            nullable=False,
        ),
        sa.Column("sort_weight", sa.Integer(), nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.Enum("ACTIVE", "INACTIVE", name="recommendationstatus"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["slot_id"], ["recommendation_slots.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_recommendation_items_slot_id"), "recommendation_items", ["slot_id"], unique=False)
    op.create_index(op.f("ix_recommendation_items_sort_weight"), "recommendation_items", ["sort_weight"], unique=False)
    op.create_index(op.f("ix_recommendation_items_status"), "recommendation_items", ["status"], unique=False)
    op.create_index(op.f("ix_recommendation_items_target_id"), "recommendation_items", ["target_id"], unique=False)

    op.create_table(
        "recommendation_topics",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("cover_asset_id", sa.Integer(), nullable=True),
        sa.Column("cover_url", sa.String(length=500), nullable=True),
        sa.Column(
            "topic_type",
            sa.Enum("FESTIVAL", "NEW_BOOKS", "EMOTION", "CULTURE", "CUSTOM", name="recommendationtopictype"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum("DRAFT", "PUBLISHED", "UNPUBLISHED", name="recommendationtopicstatus"),
            nullable=False,
        ),
        sa.Column("sort_weight", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_recommendation_topics_sort_weight"), "recommendation_topics", ["sort_weight"], unique=False)
    op.create_index(op.f("ix_recommendation_topics_status"), "recommendation_topics", ["status"], unique=False)
    op.create_index(op.f("ix_recommendation_topics_title"), "recommendation_topics", ["title"], unique=False)


def downgrade() -> None:
    op.drop_table("recommendation_topics")
    op.drop_table("recommendation_items")
    op.drop_table("recommendation_slots")
    op.drop_table("stories")
    op.drop_table("books")
