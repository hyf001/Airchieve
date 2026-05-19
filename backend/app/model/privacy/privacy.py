from enum import StrEnum

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.model.base import Base, TimestampMixin


def _now() -> datetime:
    return datetime.now(timezone.utc)


class UploadConsentTargetType(StrEnum):
    STORY = "story"
    CHARACTER_REFERENCE_IMAGE = "character_reference_image"
    VOICE_SAMPLE = "voice_sample"
    UPLOAD_FILE = "upload_file"


class PrivacyAction(StrEnum):
    SHARE = "share"
    EXPORT = "export"


class PrivacyVisibility(StrEnum):
    PRIVATE = "private"
    SHARED_LINK = "shared_link"
    PUBLIC = "public"
    SYSTEM = "system"


class PrivacyDeletionPolicy(StrEnum):
    SOFT_DELETE = "soft_delete"
    RETAIN_SNAPSHOT = "retain_snapshot"


class PrivacyUploadConsent(Base):
    __tablename__ = "privacy_upload_consents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    target_type: Mapped[UploadConsentTargetType] = mapped_column(Enum(UploadConsentTargetType), nullable=False, index=True)
    target_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    consent_text_version: Mapped[str] = mapped_column(String(40), nullable=False)
    confirmed_rights: Mapped[bool] = mapped_column(Boolean, nullable=False)
    confirmed_privacy: Mapped[bool] = mapped_column(Boolean, nullable=False)
    ip_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)


class PrivacyConfirmation(Base):
    __tablename__ = "privacy_confirmations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    action: Mapped[PrivacyAction] = mapped_column(Enum(PrivacyAction), nullable=False, index=True)
    target_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    target_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    risk_flags: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    confirmation_text_version: Mapped[str] = mapped_column(String(40), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)


class PrivacyVisibilityPolicy(TimestampMixin, Base):
    __tablename__ = "privacy_visibility_policies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    target_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    target_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    owner_user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    visibility: Mapped[PrivacyVisibility] = mapped_column(Enum(PrivacyVisibility), nullable=False, default=PrivacyVisibility.PRIVATE, index=True)
    deletion_policy: Mapped[PrivacyDeletionPolicy] = mapped_column(
        Enum(PrivacyDeletionPolicy), nullable=False, default=PrivacyDeletionPolicy.SOFT_DELETE
    )
