from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.model.base import Base, TimestampMixin


class PaymentProvider(StrEnum):
    WECHAT = "wechat"
    ALIPAY = "alipay"
    APP_STORE = "app_store"
    MANUAL = "manual"


class PaymentOrderStatus(StrEnum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    CANCELED = "canceled"
    REFUNDED = "refunded"


class PaymentEventType(StrEnum):
    PAID = "paid"
    FAILED = "failed"
    REFUNDED = "refunded"
    CANCELED = "canceled"


class RefundStatus(StrEnum):
    PENDING = "pending"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class PaymentOrder(TimestampMixin, Base):
    __tablename__ = "payment_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_no: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    plan_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    provider: Mapped[PaymentProvider] = mapped_column(Enum(PaymentProvider), nullable=False)
    status: Mapped[PaymentOrderStatus] = mapped_column(
        Enum(PaymentOrderStatus),
        nullable=False,
        default=PaymentOrderStatus.PENDING,
        index=True,
    )
    provider_order_id: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expired_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    return_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    records: Mapped[list["PaymentRecord"]] = relationship(back_populates="order")
    refunds: Mapped[list["RefundRecord"]] = relationship(back_populates="order")


class PaymentRecord(Base):
    __tablename__ = "payment_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("payment_orders.id"), nullable=False, index=True)
    provider: Mapped[PaymentProvider] = mapped_column(Enum(PaymentProvider), nullable=False)
    event_type: Mapped[PaymentEventType] = mapped_column(Enum(PaymentEventType), nullable=False, index=True)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    raw_payload: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)

    order: Mapped[PaymentOrder] = relationship(back_populates="records")


class RefundRecord(TimestampMixin, Base):
    __tablename__ = "refund_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("payment_orders.id"), nullable=False, index=True)
    refund_no: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[RefundStatus] = mapped_column(Enum(RefundStatus), nullable=False, default=RefundStatus.PENDING)
    provider_refund_id: Mapped[str | None] = mapped_column(String(120), nullable=True)

    order: Mapped[PaymentOrder] = relationship(back_populates="refunds")
