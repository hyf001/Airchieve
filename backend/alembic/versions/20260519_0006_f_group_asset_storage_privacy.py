"""f group asset storage privacy

Revision ID: 20260519_0006
Revises: 20260518_0005
Create Date: 2026-05-19
"""

from alembic import op
import sqlalchemy as sa


revision = "20260519_0006"
down_revision = "20260518_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "assets",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("owner_user_id", sa.Integer(), nullable=True),
        sa.Column("asset_kind", sa.Enum("IMAGE", "AUDIO", "VIDEO", "PDF", "OTHER", name="assetkind"), nullable=False),
        sa.Column("storage_key", sa.String(length=500), nullable=False),
        sa.Column("mime_type", sa.String(length=120), nullable=False),
        sa.Column("byte_size", sa.Integer(), nullable=True),
        sa.Column("checksum", sa.String(length=128), nullable=True),
        sa.Column("visibility", sa.Enum("PRIVATE", "PUBLIC", "SYSTEM", name="assetvisibility"), nullable=False),
        sa.Column("status", sa.Enum("UPLOADING", "READY", "DELETED", name="assetstatus"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("storage_key"),
    )
    for column in ("asset_kind", "owner_user_id", "status", "visibility"):
        op.create_index(op.f(f"ix_assets_{column}"), "assets", [column], unique=False)

    op.create_table(
        "art_styles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("owner_user_id", sa.Integer(), nullable=True),
        sa.Column("code", sa.String(length=80), nullable=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=True),
        sa.Column("example_asset_id", sa.Integer(), nullable=True),
        sa.Column("example_url", sa.String(length=500), nullable=True),
        sa.Column("age_range_codes", sa.JSON(), nullable=False),
        sa.Column("access_level", sa.Enum("FREE", "VIP", name="assetaccesslevel"), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("status", sa.Enum("ACTIVE", "INACTIVE", "DELETED", name="artstylestatus"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    for column in ("access_level", "name", "owner_user_id", "status"):
        op.create_index(op.f(f"ix_art_styles_{column}"), "art_styles", [column], unique=False)

    op.create_table(
        "characters",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("owner_user_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("identity_tag", sa.String(length=80), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("image_asset_id", sa.Integer(), nullable=True),
        sa.Column("image_url", sa.String(length=500), nullable=True),
        sa.Column("reference_asset_id", sa.Integer(), nullable=True),
        sa.Column("art_style_id", sa.Integer(), nullable=True),
        sa.Column("art_style_code", sa.String(length=80), nullable=True),
        sa.Column("custom_art_style_prompt", sa.Text(), nullable=True),
        sa.Column("generation_prompt", sa.Text(), nullable=True),
        sa.Column("category_code", sa.String(length=64), nullable=True),
        sa.Column("age_range_codes", sa.JSON(), nullable=False),
        sa.Column("access_level", sa.Enum("FREE", "VIP", name="assetaccesslevel"), nullable=False),
        sa.Column("source_type", sa.Enum("SYSTEM", "AI_GENERATED", "USER_UPLOAD", "VOICE_CLONE", name="assetsourcetype"), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False),
        sa.Column("moderation_status", sa.Enum("PENDING", "APPROVED", "REJECTED", "HIDDEN", name="assetmoderationstatus"), nullable=False),
        sa.Column("status", sa.Enum("ACTIVE", "DELETED", "DISABLED", name="libraryitemstatus"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("access_level", "art_style_id", "moderation_status", "name", "owner_user_id", "source_type", "status"):
        op.create_index(op.f(f"ix_characters_{column}"), "characters", [column], unique=False)
    op.create_index(
        "uq_characters_one_default_per_user",
        "characters",
        ["owner_user_id"],
        unique=True,
        postgresql_where=sa.text("is_default = true AND owner_user_id IS NOT NULL"),
        sqlite_where=sa.text("is_default = 1 AND owner_user_id IS NOT NULL"),
    )

    op.create_table(
        "voices",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("owner_user_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("voice_style_code", sa.String(length=64), nullable=True),
        sa.Column("sample_asset_id", sa.Integer(), nullable=True),
        sa.Column("sample_url", sa.String(length=500), nullable=True),
        sa.Column("source_sample_asset_id", sa.Integer(), nullable=True),
        sa.Column("supported_languages", sa.JSON(), nullable=False),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("access_level", sa.Enum("FREE", "VIP", name="assetaccesslevel"), nullable=False),
        sa.Column("source_type", sa.Enum("SYSTEM", "AI_GENERATED", "USER_UPLOAD", "VOICE_CLONE", name="assetsourcetype"), nullable=False),
        sa.Column("processing_status", sa.Enum("PENDING", "PROCESSING", "READY", "FAILED", name="voiceprocessingstatus"), nullable=False),
        sa.Column("failure_reason", sa.String(length=300), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=False),
        sa.Column("moderation_status", sa.Enum("PENDING", "APPROVED", "REJECTED", "HIDDEN", name="assetmoderationstatus"), nullable=False),
        sa.Column("status", sa.Enum("ACTIVE", "DELETED", "DISABLED", name="libraryitemstatus"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("access_level", "moderation_status", "name", "owner_user_id", "processing_status", "source_type", "status"):
        op.create_index(op.f(f"ix_voices_{column}"), "voices", [column], unique=False)
    op.create_index(
        "uq_voices_one_default_per_user",
        "voices",
        ["owner_user_id"],
        unique=True,
        postgresql_where=sa.text("is_default = true AND owner_user_id IS NOT NULL"),
        sqlite_where=sa.text("is_default = 1 AND owner_user_id IS NOT NULL"),
    )

    op.create_table(
        "storage_upload_sessions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("purpose", sa.Enum("CHARACTER", "VOICE", "STORY_FILE", "BOOK_MEDIA", "EXPORT", "TASK_RESULT", name="uploadpurpose"), nullable=False),
        sa.Column("filename", sa.String(length=240), nullable=False),
        sa.Column("mime_type", sa.String(length=120), nullable=False),
        sa.Column("max_byte_size", sa.Integer(), nullable=False),
        sa.Column("storage_key", sa.String(length=500), nullable=False),
        sa.Column("status", sa.Enum("CREATED", "COMPLETED", "EXPIRED", "FAILED", name="uploadsessionstatus"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("storage_key"),
    )
    for column in ("purpose", "status", "user_id"):
        op.create_index(op.f(f"ix_storage_upload_sessions_{column}"), "storage_upload_sessions", [column], unique=False)

    op.create_table(
        "privacy_upload_consents",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("target_type", sa.Enum("STORY", "CHARACTER_REFERENCE_IMAGE", "VOICE_SAMPLE", "UPLOAD_FILE", name="uploadconsenttargettype"), nullable=False),
        sa.Column("target_id", sa.Integer(), nullable=True),
        sa.Column("consent_text_version", sa.String(length=40), nullable=False),
        sa.Column("confirmed_rights", sa.Boolean(), nullable=False),
        sa.Column("confirmed_privacy", sa.Boolean(), nullable=False),
        sa.Column("ip_hash", sa.String(length=128), nullable=True),
        sa.Column("user_agent", sa.String(length=300), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("target_id", "target_type", "user_id"):
        op.create_index(op.f(f"ix_privacy_upload_consents_{column}"), "privacy_upload_consents", [column], unique=False)

    op.create_table(
        "privacy_confirmations",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("action", sa.Enum("SHARE", "EXPORT", name="privacyaction"), nullable=False),
        sa.Column("target_type", sa.String(length=80), nullable=False),
        sa.Column("target_id", sa.Integer(), nullable=False),
        sa.Column("risk_flags", sa.JSON(), nullable=False),
        sa.Column("confirmation_text_version", sa.String(length=40), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("action", "target_id", "target_type", "user_id"):
        op.create_index(op.f(f"ix_privacy_confirmations_{column}"), "privacy_confirmations", [column], unique=False)

    op.create_table(
        "privacy_visibility_policies",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("target_type", sa.String(length=80), nullable=False),
        sa.Column("target_id", sa.Integer(), nullable=False),
        sa.Column("owner_user_id", sa.Integer(), nullable=False),
        sa.Column("visibility", sa.Enum("PRIVATE", "SHARED_LINK", "PUBLIC", "SYSTEM", name="privacyvisibility"), nullable=False),
        sa.Column("deletion_policy", sa.Enum("SOFT_DELETE", "RETAIN_SNAPSHOT", name="privacydeletionpolicy"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("owner_user_id", "target_id", "target_type", "visibility"):
        op.create_index(op.f(f"ix_privacy_visibility_policies_{column}"), "privacy_visibility_policies", [column], unique=False)


def downgrade() -> None:
    op.drop_table("privacy_visibility_policies")
    op.drop_table("privacy_confirmations")
    op.drop_table("privacy_upload_consents")
    op.drop_table("storage_upload_sessions")
    op.drop_table("voices")
    op.drop_table("characters")
    op.drop_table("art_styles")
    op.drop_table("assets")
    if op.get_bind().dialect.name == "postgresql":
        for enum_name in (
            "privacydeletionpolicy",
            "privacyvisibility",
            "privacyaction",
            "uploadconsenttargettype",
            "uploadsessionstatus",
            "uploadpurpose",
            "voiceprocessingstatus",
            "libraryitemstatus",
            "assetmoderationstatus",
            "assetsourcetype",
            "artstylestatus",
            "assetaccesslevel",
            "assetstatus",
            "assetvisibility",
            "assetkind",
        ):
            op.execute(sa.text(f"DROP TYPE IF EXISTS {enum_name}"))
