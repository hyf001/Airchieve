from datetime import datetime, timezone
from enum import StrEnum

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.model.base import Base, TimestampMixin


class DomainEventDeliveryStatus(StrEnum):
    PENDING = "pending"
    CONSUMED = "consumed"
    FAILED = "failed"


class DomainEvent(Base):
    __tablename__ = "domain_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_type: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    actor_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    actor_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    target_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    target_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    payload: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)
    idempotency_key: Mapped[str | None] = mapped_column(String(160), nullable=True, unique=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    deliveries: Mapped[list["DomainEventDelivery"]] = relationship(back_populates="event", cascade="all, delete-orphan")


class DomainEventDelivery(TimestampMixin, Base):
    __tablename__ = "domain_event_deliveries"
    __table_args__ = (UniqueConstraint("event_id", "consumer", name="uq_domain_event_delivery_consumer"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("domain_events.id"), nullable=False, index=True)
    consumer: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    status: Mapped[DomainEventDeliveryStatus] = mapped_column(
        Enum(DomainEventDeliveryStatus),
        nullable=False,
        default=DomainEventDeliveryStatus.PENDING,
        index=True,
    )
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    event: Mapped[DomainEvent] = relationship(back_populates="deliveries")
