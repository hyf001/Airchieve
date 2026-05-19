from enum import StrEnum

from sqlalchemy import DateTime, Enum, Integer, JSON, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.model.base import Base, TimestampMixin


class AiProviderCapability(StrEnum):
    TEXT = "text"
    STRUCTURED = "structured"
    IMAGE = "image"
    AUDIO = "audio"
    LIP_SYNC = "lip_sync"


class AiProviderCallStatus(StrEnum):
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    TIMEOUT = "timeout"
    CANCELED = "canceled"


class AiProviderUsageType(StrEnum):
    TOKENS = "tokens"
    IMAGE_COUNT = "image_count"
    AUDIO_SECONDS = "audio_seconds"
    VIDEO_SECONDS = "video_seconds"
    REQUEST_COUNT = "request_count"


class AiProviderCall(TimestampMixin, Base):
    __tablename__ = "ai_provider_calls"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    provider: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    model: Mapped[str] = mapped_column(String(120), nullable=False)
    capability: Mapped[AiProviderCapability] = mapped_column(Enum(AiProviderCapability), nullable=False)
    request_payload_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    response_payload_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[AiProviderCallStatus] = mapped_column(Enum(AiProviderCallStatus), nullable=False, index=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(80), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)


class AiProviderUsageRecord(TimestampMixin, Base):
    __tablename__ = "ai_provider_usage_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    provider_call_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    model: Mapped[str] = mapped_column(String(120), nullable=False)
    usage_type: Mapped[AiProviderUsageType] = mapped_column(Enum(AiProviderUsageType), nullable=False, index=True)
    usage_amount: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    estimated_cost: Mapped[float | None] = mapped_column(Numeric(12, 6), nullable=True)
    currency: Mapped[str | None] = mapped_column(String(12), nullable=True)
    occurred_at: Mapped[object] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
