from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.model.base import Base, TimestampMixin


class UploadPurpose(StrEnum):
    CHARACTER = "character"
    VOICE = "voice"
    STORY_FILE = "story_file"
    BOOK_MEDIA = "book_media"
    EXPORT = "export"
    TASK_RESULT = "task_result"


class UploadSessionStatus(StrEnum):
    CREATED = "created"
    COMPLETED = "completed"
    EXPIRED = "expired"
    FAILED = "failed"


class StorageUploadSession(TimestampMixin, Base):
    __tablename__ = "storage_upload_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    purpose: Mapped[UploadPurpose] = mapped_column(Enum(UploadPurpose), nullable=False, index=True)
    filename: Mapped[str] = mapped_column(String(240), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(120), nullable=False)
    max_byte_size: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False, unique=True)
    status: Mapped[UploadSessionStatus] = mapped_column(Enum(UploadSessionStatus), nullable=False, default=UploadSessionStatus.CREATED, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
