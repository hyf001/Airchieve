from datetime import date, datetime, timezone
from enum import StrEnum

from sqlalchemy import Date, DateTime, Enum, Integer, JSON, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.model.base import Base, TimestampMixin


class AnalyticsActorType(StrEnum):
    ANONYMOUS = "anonymous"
    USER = "user"
    ADMIN = "admin"
    SYSTEM = "system"


class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_type: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    actor_type: Mapped[AnalyticsActorType] = mapped_column(Enum(AnalyticsActorType), nullable=False, index=True)
    actor_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    target_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    target_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    session_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    payload: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )


class AnalyticsDailyMetric(TimestampMixin, Base):
    __tablename__ = "analytics_daily_metrics"
    __table_args__ = (
        UniqueConstraint(
            "metric_date",
            "target_type",
            "target_id",
            "metric_key",
            "dimensions_hash",
            name="uq_analytics_daily_metric_scope",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    metric_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    target_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    target_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    metric_key: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    metric_value: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    dimensions: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)
    dimensions_hash: Mapped[str] = mapped_column(String(64), nullable=False, default="default")
