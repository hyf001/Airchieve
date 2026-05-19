from enum import StrEnum

from sqlalchemy import Boolean, Enum, Integer, JSON, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.model.base import Base, TimestampMixin


class TemplateAccessLevel(StrEnum):
    FREE = "free"
    PREVIEW = "preview"
    VIP = "vip"


class TemplateVoiceScope(StrEnum):
    DEFAULT_ONLY = "default_only"
    SYSTEM = "system"
    USER_AND_SYSTEM = "user_and_system"


class TemplateStatus(StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"
    UNPUBLISHED = "unpublished"
    DELETED = "deleted"


class TemplateValidationStatus(StrEnum):
    UNCHECKED = "unchecked"
    VALID = "valid"
    INVALID = "invalid"


class TemplateRegionStatus(StrEnum):
    ACTIVE = "active"
    DISABLED = "disabled"


class TemplateCreationStatus(StrEnum):
    PREVIEWING = "previewing"
    GENERATING = "generating"
    SAVED = "saved"
    FAILED = "failed"


class BookTemplate(TimestampMixin, Base):
    __tablename__ = "book_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_book_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_asset_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cover_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    default_voice_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    default_voice_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    access_level: Mapped[TemplateAccessLevel] = mapped_column(Enum(TemplateAccessLevel), nullable=False, default=TemplateAccessLevel.FREE)
    allow_voice_replacement: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    allowed_voice_scope: Mapped[TemplateVoiceScope] = mapped_column(
        Enum(TemplateVoiceScope),
        nullable=False,
        default=TemplateVoiceScope.USER_AND_SYSTEM,
    )
    status: Mapped[TemplateStatus] = mapped_column(Enum(TemplateStatus), nullable=False, default=TemplateStatus.DRAFT, index=True)
    validation_status: Mapped[TemplateValidationStatus] = mapped_column(
        Enum(TemplateValidationStatus),
        nullable=False,
        default=TemplateValidationStatus.UNCHECKED,
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class TemplateCharacter(TimestampMixin, Base):
    __tablename__ = "template_characters"
    __table_args__ = (UniqueConstraint("template_id", "role_code", name="uq_template_characters_template_role"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    template_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    role_code: Mapped[str] = mapped_column(String(80), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    default_character_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    default_character_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    allowed_replacement_sources: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    appear_page_nos: Mapped[list[int]] = mapped_column(JSON, nullable=False, default=list)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class TemplateReplaceRegion(TimestampMixin, Base):
    __tablename__ = "template_replace_regions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    template_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    template_character_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    page_id: Mapped[int] = mapped_column(Integer, nullable=False)
    page_no: Mapped[int] = mapped_column(Integer, nullable=False)
    x: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False)
    y: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False)
    width: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False)
    height: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False)
    mask_asset_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    z_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    border_radius: Mapped[float | None] = mapped_column(Numeric(6, 4), nullable=True)
    replacement_rule: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    status: Mapped[TemplateRegionStatus] = mapped_column(Enum(TemplateRegionStatus), nullable=False, default=TemplateRegionStatus.ACTIVE)


class TemplateCreationRecord(TimestampMixin, Base):
    __tablename__ = "template_creation_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    template_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    result_book_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    replacements: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    status: Mapped[TemplateCreationStatus] = mapped_column(
        Enum(TemplateCreationStatus),
        nullable=False,
        default=TemplateCreationStatus.PREVIEWING,
        index=True,
    )
