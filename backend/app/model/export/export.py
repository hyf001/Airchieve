from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.model.base import Base, TimestampMixin


class ExportType(StrEnum):
    PDF = "pdf"


class ExportQuality(StrEnum):
    STANDARD = "standard"
    HIGH = "high"


class ExportJobStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    EXPIRED = "expired"


class ExportJob(TimestampMixin, Base):
    __tablename__ = "export_jobs"
    __table_args__ = (UniqueConstraint("user_id", "idempotency_key", name="uq_export_jobs_user_idempotency"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    book_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    export_type: Mapped[ExportType] = mapped_column(Enum(ExportType), nullable=False, default=ExportType.PDF, index=True)
    quality: Mapped[ExportQuality] = mapped_column(Enum(ExportQuality), nullable=False, default=ExportQuality.STANDARD)
    status: Mapped[ExportJobStatus] = mapped_column(Enum(ExportJobStatus), nullable=False, default=ExportJobStatus.QUEUED, index=True)
    generation_task_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    file_asset_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    book_snapshot: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
    privacy_confirmation_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    quota_reservation_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
