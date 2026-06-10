from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.model.base import Base, TimestampMixin


class GenerationTaskType(StrEnum):
    STORY = "story"
    STORYBOARD = "storyboard"
    CHARACTER_IMAGE = "character_image"
    IMAGE = "image"
    PAGE_IMAGE = "page_image"
    AUDIO = "audio"
    LIP_SYNC = "lip_sync"
    TEMPLATE_COMPOSITE = "template_composite"
    PDF_EXPORT = "pdf_export"


class GenerationTaskStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELED = "canceled"


class GenerationAttemptStatus(StrEnum):
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class GenerationTask(TimestampMixin, Base):
    __tablename__ = "generation_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_type: Mapped[GenerationTaskType] = mapped_column(Enum(GenerationTaskType), nullable=False, index=True)
    owner_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    owner_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    status: Mapped[GenerationTaskStatus] = mapped_column(
        Enum(GenerationTaskStatus),
        nullable=False,
        default=GenerationTaskStatus.QUEUED,
        index=True,
    )
    progress_percent: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    input_payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    output_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    provider: Mapped[str | None] = mapped_column(String(80), nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(80), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    attempts: Mapped[list["GenerationTaskAttempt"]] = relationship(
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="GenerationTaskAttempt.attempt_no",
    )

    @property
    def result_refs(self) -> dict | None:
        return self.output_payload

    @property
    def retryable(self) -> bool:
        return self.status == GenerationTaskStatus.FAILED and self.retry_count < 3


class GenerationTaskAttempt(Base):
    __tablename__ = "generation_task_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("generation_tasks.id"), nullable=False, index=True)
    attempt_no: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[GenerationAttemptStatus] = mapped_column(Enum(GenerationAttemptStatus), nullable=False)
    provider_request_id: Mapped[str | None] = mapped_column(String(160), nullable=True)
    error_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    task: Mapped[GenerationTask] = relationship(back_populates="attempts")
