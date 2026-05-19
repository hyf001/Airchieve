"""e group creation template generation

Revision ID: 20260518_0005
Revises: 20260518_0004
Create Date: 2026-05-18
"""

from alembic import op
import sqlalchemy as sa


revision = "20260518_0005"
down_revision = "20260518_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "creation_sessions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("child_profile_id", sa.Integer(), nullable=True),
        sa.Column("creation_type", sa.Enum("STORY_TO_BOOK", "TEMPLATE_BOOK", "SIMILAR_BOOK", name="creationtype"), nullable=False),
        sa.Column("status", sa.Enum("DRAFT", "GENERATING", "PREVIEW", "SAVED", "FAILED", "CANCELED", name="creationsessionstatus"), nullable=False),
        sa.Column("current_step", sa.Enum("STORY", "TEMPLATE", "CHARACTER", "ART_STYLE", "STORYBOARD", "VOICE", "PREVIEW", name="creationstep"), nullable=False),
        sa.Column("story_source_type", sa.Enum("SYSTEM_STORY", "USER_STORY", "UPLOADED_STORY", "IDEA", name="creationstorysourcetype"), nullable=True),
        sa.Column("story_id", sa.Integer(), nullable=True),
        sa.Column("template_id", sa.Integer(), nullable=True),
        sa.Column("idea_prompt", sa.Text(), nullable=True),
        sa.Column("reference_book_id", sa.Integer(), nullable=True),
        sa.Column("language", sa.Enum("ZH", "EN", "BILINGUAL", name="creationlanguage"), nullable=False),
        sa.Column("target_page_count", sa.Integer(), nullable=False),
        sa.Column("age_range_codes", sa.JSON(), nullable=False),
        sa.Column("theme_codes", sa.JSON(), nullable=False),
        sa.Column("education_goal_codes", sa.JSON(), nullable=False),
        sa.Column("narrative_style_code", sa.String(length=64), nullable=True),
        sa.Column("character_refs", sa.JSON(), nullable=False),
        sa.Column("art_style_ref", sa.JSON(), nullable=True),
        sa.Column("voice_ref", sa.JSON(), nullable=True),
        sa.Column("quota_reservation_id", sa.Integer(), nullable=True),
        sa.Column("saved_book_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("child_profile_id", "creation_type", "status", "story_id", "template_id", "reference_book_id", "user_id"):
        op.create_index(op.f(f"ix_creation_sessions_{column}"), "creation_sessions", [column], unique=False)

    op.create_table(
        "creation_storyboard_pages",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("page_no", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=True),
        sa.Column("text_zh", sa.Text(), nullable=True),
        sa.Column("text_en", sa.Text(), nullable=True),
        sa.Column("narration_text", sa.Text(), nullable=True),
        sa.Column("visual_prompt", sa.Text(), nullable=False),
        sa.Column("character_appearances", sa.JSON(), nullable=False),
        sa.Column("dialogues", sa.JSON(), nullable=False),
        sa.Column("image_asset_id", sa.Integer(), nullable=True),
        sa.Column("audio_asset_id", sa.Integer(), nullable=True),
        sa.Column("generation_status", sa.Enum("DRAFT", "PENDING", "READY", "FAILED", name="storyboardgenerationstatus"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["creation_sessions.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id", "page_no", name="uq_creation_storyboard_session_page_no"),
    )
    op.create_index(op.f("ix_creation_storyboard_pages_session_id"), "creation_storyboard_pages", ["session_id"], unique=False)

    op.create_table(
        "generation_tasks",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("task_type", sa.Enum("STORY", "STORYBOARD", "CHARACTER_IMAGE", "IMAGE", "AUDIO", "LIP_SYNC", "TEMPLATE_COMPOSITE", "PDF_EXPORT", name="generationtasktype"), nullable=False),
        sa.Column("owner_type", sa.String(length=80), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.Enum("QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELED", name="generationtaskstatus"), nullable=False),
        sa.Column("progress_percent", sa.Integer(), nullable=False),
        sa.Column("input_payload", sa.JSON(), nullable=False),
        sa.Column("output_payload", sa.JSON(), nullable=True),
        sa.Column("provider", sa.String(length=80), nullable=True),
        sa.Column("error_code", sa.String(length=80), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("retry_count", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("owner_id", "owner_type", "status", "task_type", "user_id"):
        op.create_index(op.f(f"ix_generation_tasks_{column}"), "generation_tasks", [column], unique=False)

    op.create_table(
        "generation_task_attempts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("task_id", sa.Integer(), nullable=False),
        sa.Column("attempt_no", sa.Integer(), nullable=False),
        sa.Column("status", sa.Enum("RUNNING", "SUCCEEDED", "FAILED", name="generationattemptstatus"), nullable=False),
        sa.Column("provider_request_id", sa.String(length=160), nullable=True),
        sa.Column("error_payload", sa.JSON(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["task_id"], ["generation_tasks.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_generation_task_attempts_task_id"), "generation_task_attempts", ["task_id"], unique=False)

    op.create_table(
        "ai_provider_calls",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("task_id", sa.Integer(), nullable=True),
        sa.Column("provider", sa.String(length=80), nullable=False),
        sa.Column("model", sa.String(length=120), nullable=False),
        sa.Column("capability", sa.Enum("TEXT", "STRUCTURED", "IMAGE", "AUDIO", "LIP_SYNC", name="aiprovidercapability"), nullable=False),
        sa.Column("request_payload_snapshot", sa.JSON(), nullable=True),
        sa.Column("response_payload_snapshot", sa.JSON(), nullable=True),
        sa.Column("status", sa.Enum("SUCCEEDED", "FAILED", "TIMEOUT", "CANCELED", name="aiprovidercallstatus"), nullable=False),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("error_code", sa.String(length=80), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("created_at", "provider", "status", "task_id"):
        op.create_index(op.f(f"ix_ai_provider_calls_{column}"), "ai_provider_calls", [column], unique=False)

    op.create_table(
        "ai_provider_usage_records",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("provider_call_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(length=80), nullable=False),
        sa.Column("model", sa.String(length=120), nullable=False),
        sa.Column("usage_type", sa.Enum("TOKENS", "IMAGE_COUNT", "AUDIO_SECONDS", "VIDEO_SECONDS", "REQUEST_COUNT", name="aiproviderusagetype"), nullable=False),
        sa.Column("usage_amount", sa.Numeric(precision=12, scale=4), nullable=False),
        sa.Column("estimated_cost", sa.Numeric(precision=12, scale=6), nullable=True),
        sa.Column("currency", sa.String(length=12), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("occurred_at", "provider", "provider_call_id", "usage_type"):
        op.create_index(op.f(f"ix_ai_provider_usage_records_{column}"), "ai_provider_usage_records", [column], unique=False)

    op.create_table(
        "book_templates",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("source_book_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("cover_asset_id", sa.Integer(), nullable=True),
        sa.Column("cover_url", sa.String(length=500), nullable=True),
        sa.Column("default_voice_id", sa.Integer(), nullable=True),
        sa.Column("default_voice_name", sa.String(length=120), nullable=True),
        sa.Column("access_level", sa.Enum("FREE", "PREVIEW", "VIP", name="templateaccesslevel"), nullable=False),
        sa.Column("allow_voice_replacement", sa.Boolean(), nullable=False),
        sa.Column("allowed_voice_scope", sa.Enum("DEFAULT_ONLY", "SYSTEM", "USER_AND_SYSTEM", name="templatevoicescope"), nullable=False),
        sa.Column("status", sa.Enum("DRAFT", "PUBLISHED", "UNPUBLISHED", "DELETED", name="templatestatus"), nullable=False),
        sa.Column("validation_status", sa.Enum("UNCHECKED", "VALID", "INVALID", name="templatevalidationstatus"), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("source_book_id", "status", "title"):
        op.create_index(op.f(f"ix_book_templates_{column}"), "book_templates", [column], unique=False)

    op.create_table(
        "template_characters",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("template_id", sa.Integer(), nullable=False),
        sa.Column("role_code", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("required", sa.Boolean(), nullable=False),
        sa.Column("default_character_id", sa.Integer(), nullable=True),
        sa.Column("default_character_name", sa.String(length=120), nullable=True),
        sa.Column("allowed_replacement_sources", sa.JSON(), nullable=False),
        sa.Column("appear_page_nos", sa.JSON(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("template_id", "role_code", name="uq_template_characters_template_role"),
    )
    op.create_index(op.f("ix_template_characters_template_id"), "template_characters", ["template_id"], unique=False)

    op.create_table(
        "template_replace_regions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("template_id", sa.Integer(), nullable=False),
        sa.Column("template_character_id", sa.Integer(), nullable=False),
        sa.Column("page_id", sa.Integer(), nullable=False),
        sa.Column("page_no", sa.Integer(), nullable=False),
        sa.Column("x", sa.Numeric(precision=6, scale=4), nullable=False),
        sa.Column("y", sa.Numeric(precision=6, scale=4), nullable=False),
        sa.Column("width", sa.Numeric(precision=6, scale=4), nullable=False),
        sa.Column("height", sa.Numeric(precision=6, scale=4), nullable=False),
        sa.Column("mask_asset_id", sa.Integer(), nullable=True),
        sa.Column("z_index", sa.Integer(), nullable=False),
        sa.Column("border_radius", sa.Numeric(precision=6, scale=4), nullable=True),
        sa.Column("replacement_rule", sa.JSON(), nullable=False),
        sa.Column("status", sa.Enum("ACTIVE", "DISABLED", name="templateregionstatus"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_template_replace_regions_template_character_id"), "template_replace_regions", ["template_character_id"], unique=False)
    op.create_index(op.f("ix_template_replace_regions_template_id"), "template_replace_regions", ["template_id"], unique=False)

    op.create_table(
        "template_creation_records",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("template_id", sa.Integer(), nullable=False),
        sa.Column("result_book_id", sa.Integer(), nullable=True),
        sa.Column("replacements", sa.JSON(), nullable=False),
        sa.Column("status", sa.Enum("PREVIEWING", "GENERATING", "SAVED", "FAILED", name="templatecreationstatus"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("status", "template_id", "user_id"):
        op.create_index(op.f(f"ix_template_creation_records_{column}"), "template_creation_records", [column], unique=False)


def downgrade() -> None:
    op.drop_table("template_creation_records")
    op.drop_table("template_replace_regions")
    op.drop_table("template_characters")
    op.drop_table("book_templates")
    op.drop_table("ai_provider_usage_records")
    op.drop_table("ai_provider_calls")
    op.drop_table("generation_task_attempts")
    op.drop_table("generation_tasks")
    op.drop_table("creation_storyboard_pages")
    op.drop_table("creation_sessions")
