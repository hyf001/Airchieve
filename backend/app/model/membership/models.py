from datetime import datetime
from enum import StrEnum

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.model.base import Base, TimestampMixin


class BillingPeriod(StrEnum):
    NONE = "none"
    MONTH = "month"
    QUARTER = "quarter"
    YEAR = "year"


class MembershipPlanStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class UserMembershipStatus(StrEnum):
    FREE = "free"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELED = "canceled"
    EXPIRED = "expired"


class MembershipSource(StrEnum):
    SYSTEM = "system"
    PAYMENT = "payment"
    ADMIN = "admin"


class MembershipPlan(TimestampMixin, Base):
    __tablename__ = "membership_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="CNY")
    billing_period: Mapped[BillingPeriod] = mapped_column(Enum(BillingPeriod), nullable=False)
    entitlement_config: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, index=True)
    status: Mapped[MembershipPlanStatus] = mapped_column(
        Enum(MembershipPlanStatus),
        nullable=False,
        default=MembershipPlanStatus.ACTIVE,
        index=True,
    )

    memberships: Mapped[list["UserMembership"]] = relationship(back_populates="plan")


class UserMembership(TimestampMixin, Base):
    __tablename__ = "user_memberships"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("membership_plans.id"), nullable=False, index=True)
    status: Mapped[UserMembershipStatus] = mapped_column(Enum(UserMembershipStatus), nullable=False, index=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    current_period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    auto_renew: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    source: Mapped[MembershipSource] = mapped_column(Enum(MembershipSource), nullable=False)

    plan: Mapped[MembershipPlan] = relationship(back_populates="memberships")


class MembershipUsageCounter(TimestampMixin, Base):
    __tablename__ = "membership_usage_counters"
    __table_args__ = (
        UniqueConstraint("user_id", "quota_key", "period_key", name="uq_membership_usage_user_quota_period"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    quota_key: Mapped[str] = mapped_column(String(80), nullable=False)
    period_key: Mapped[str] = mapped_column(String(32), nullable=False)
    used_amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    reserved_amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    reset_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
