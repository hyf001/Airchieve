from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.model.base import Base, TimestampMixin


class QuotaReservationStatus(StrEnum):
    RESERVED = "reserved"
    CONFIRMED = "confirmed"
    RELEASED = "released"
    EXPIRED = "expired"


class EntitlementQuotaReservation(TimestampMixin, Base):
    __tablename__ = "entitlement_quota_reservations"
    __table_args__ = (
        UniqueConstraint("user_id", "quota_key", "idempotency_key", name="uq_entitlement_reservation_idempotency"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    quota_key: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    period_key: Mapped[str] = mapped_column(String(32), nullable=False)
    idempotency_key: Mapped[str | None] = mapped_column(String(120), nullable=True)
    status: Mapped[QuotaReservationStatus] = mapped_column(
        Enum(QuotaReservationStatus),
        nullable=False,
        default=QuotaReservationStatus.RESERVED,
        index=True,
    )
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
