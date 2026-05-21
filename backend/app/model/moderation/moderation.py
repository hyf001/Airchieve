from datetime import datetime, timezone
from enum import StrEnum

from sqlalchemy import DateTime, Enum, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.model.base import Base, TimestampMixin


class ModerationStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    HIDDEN = "hidden"


class ReportReasonType(StrEnum):
    AGE_INAPPROPRIATE = "age_inappropriate"
    COPYRIGHT = "copyright"
    PRIVACY = "privacy"
    ABNORMAL = "abnormal"
    OTHER = "other"


class ReportStatus(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    RESOLVED = "resolved"
    REJECTED = "rejected"


class ModerationRecord(TimestampMixin, Base):
    __tablename__ = "moderation_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    target_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    target_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    submitter_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    status: Mapped[ModerationStatus] = mapped_column(
        Enum(ModerationStatus),
        nullable=False,
        default=ModerationStatus.PENDING,
        index=True,
    )
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewer_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    snapshot: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)


class Report(TimestampMixin, Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reporter_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    target_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    target_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    reason_type: Mapped[ReportReasonType] = mapped_column(Enum(ReportReasonType), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ReportStatus] = mapped_column(Enum(ReportStatus), nullable=False, default=ReportStatus.PENDING, index=True)
    handler_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    result: Mapped[str | None] = mapped_column(Text, nullable=True)

    def mark_resolved(self, handler_id: int, result: str) -> None:
        self.status = ReportStatus.RESOLVED
        self.handler_id = handler_id
        self.result = result
        self.updated_at = datetime.now(timezone.utc)
