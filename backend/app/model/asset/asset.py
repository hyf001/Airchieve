from enum import StrEnum

from sqlalchemy import Boolean, Enum, Index, Integer, JSON, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.model.base import Base, TimestampMixin


class AssetKind(StrEnum):
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"
    PDF = "pdf"
    OTHER = "other"


class AssetVisibility(StrEnum):
    PRIVATE = "private"
    PUBLIC = "public"
    SYSTEM = "system"


class AssetStatus(StrEnum):
    UPLOADING = "uploading"
    READY = "ready"
    DELETED = "deleted"


class AssetAccessLevel(StrEnum):
    FREE = "free"
    VIP = "vip"


class AssetSourceType(StrEnum):
    SYSTEM = "system"
    AI_GENERATED = "ai_generated"
    USER_UPLOAD = "user_upload"
    VOICE_CLONE = "voice_clone"


class AssetModerationStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    HIDDEN = "hidden"


class LibraryItemStatus(StrEnum):
    ACTIVE = "active"
    DELETED = "deleted"
    DISABLED = "disabled"


class ArtStyleStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    DELETED = "deleted"


class VoiceProcessingStatus(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class Asset(TimestampMixin, Base):
    __tablename__ = "assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    asset_kind: Mapped[AssetKind] = mapped_column(Enum(AssetKind), nullable=False, index=True)
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False, unique=True)
    mime_type: Mapped[str] = mapped_column(String(120), nullable=False)
    byte_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    checksum: Mapped[str | None] = mapped_column(String(128), nullable=True)
    visibility: Mapped[AssetVisibility] = mapped_column(Enum(AssetVisibility), nullable=False, default=AssetVisibility.PRIVATE, index=True)
    status: Mapped[AssetStatus] = mapped_column(Enum(AssetStatus), nullable=False, default=AssetStatus.UPLOADING, index=True)


class ArtStyle(TimestampMixin, Base):
    __tablename__ = "art_styles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    code: Mapped[str | None] = mapped_column(String(80), nullable=True, unique=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    example_asset_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    example_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    age_range_codes: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    access_level: Mapped[AssetAccessLevel] = mapped_column(Enum(AssetAccessLevel), nullable=False, default=AssetAccessLevel.FREE, index=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[ArtStyleStatus] = mapped_column(Enum(ArtStyleStatus), nullable=False, default=ArtStyleStatus.ACTIVE, index=True)


class Character(TimestampMixin, Base):
    __tablename__ = "characters"
    __table_args__ = (
        Index(
            "uq_characters_one_default_per_user",
            "owner_user_id",
            unique=True,
            postgresql_where=text("is_default = true AND owner_user_id IS NOT NULL"),
            sqlite_where=text("is_default = 1 AND owner_user_id IS NOT NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    identity_tag: Mapped[str | None] = mapped_column(String(80), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_asset_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    reference_asset_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    art_style_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    art_style_code: Mapped[str | None] = mapped_column(String(80), nullable=True)
    custom_art_style_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    generation_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    category_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    age_range_codes: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    access_level: Mapped[AssetAccessLevel] = mapped_column(Enum(AssetAccessLevel), nullable=False, default=AssetAccessLevel.FREE, index=True)
    source_type: Mapped[AssetSourceType] = mapped_column(Enum(AssetSourceType), nullable=False, default=AssetSourceType.AI_GENERATED, index=True)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    moderation_status: Mapped[AssetModerationStatus] = mapped_column(
        Enum(AssetModerationStatus), nullable=False, default=AssetModerationStatus.APPROVED, index=True
    )
    status: Mapped[LibraryItemStatus] = mapped_column(Enum(LibraryItemStatus), nullable=False, default=LibraryItemStatus.ACTIVE, index=True)


class Voice(TimestampMixin, Base):
    __tablename__ = "voices"
    __table_args__ = (
        Index(
            "uq_voices_one_default_per_user",
            "owner_user_id",
            unique=True,
            postgresql_where=text("is_default = true AND owner_user_id IS NOT NULL"),
            sqlite_where=text("is_default = 1 AND owner_user_id IS NOT NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    voice_style_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    sample_asset_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sample_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    source_sample_asset_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    supported_languages: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    access_level: Mapped[AssetAccessLevel] = mapped_column(Enum(AssetAccessLevel), nullable=False, default=AssetAccessLevel.FREE, index=True)
    source_type: Mapped[AssetSourceType] = mapped_column(Enum(AssetSourceType), nullable=False, default=AssetSourceType.USER_UPLOAD, index=True)
    processing_status: Mapped[VoiceProcessingStatus] = mapped_column(
        Enum(VoiceProcessingStatus), nullable=False, default=VoiceProcessingStatus.PENDING, index=True
    )
    failure_reason: Mapped[str | None] = mapped_column(String(300), nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    moderation_status: Mapped[AssetModerationStatus] = mapped_column(
        Enum(AssetModerationStatus), nullable=False, default=AssetModerationStatus.APPROVED, index=True
    )
    status: Mapped[LibraryItemStatus] = mapped_column(Enum(LibraryItemStatus), nullable=False, default=LibraryItemStatus.ACTIVE, index=True)
