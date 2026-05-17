from datetime import datetime, timezone
from enum import StrEnum

from sqlalchemy import DateTime, Enum, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.model.base import Base


class AuditOperatorType(StrEnum):
    ADMIN = "admin"
    SYSTEM = "system"
    PAYMENT_PROVIDER = "payment_provider"


class AuditResult(StrEnum):
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    operator_type: Mapped[AuditOperatorType] = mapped_column(Enum(AuditOperatorType), nullable=False)
    operator_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    target_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    target_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    before_snapshot: Mapped[dict[str, object] | None] = mapped_column(JSON, nullable=True)
    after_snapshot: Mapped[dict[str, object] | None] = mapped_column(JSON, nullable=True)
    result: Mapped[AuditResult] = mapped_column(Enum(AuditResult), nullable=False, default=AuditResult.SUCCEEDED)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    request_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    ip_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
