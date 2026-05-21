from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.model.analytics import AnalyticsActorType


class AnalyticsTarget(BaseModel):
    target_type: str = Field(min_length=1, max_length=80)
    target_id: int = Field(ge=1)


class AnalyticsActor(BaseModel):
    actor_type: AnalyticsActorType
    actor_id: int | None = None


class AnalyticsEventCreate(AnalyticsTarget, AnalyticsActor):
    event_type: str = Field(min_length=1, max_length=120)
    session_id: int | None = None
    payload: dict[str, object] = Field(default_factory=dict)
    occurred_at: datetime | None = None


class AnalyticsEventRead(AnalyticsEventCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    occurred_at: datetime


class MetricPoint(BaseModel):
    metric_key: str
    metric_value: float


class BookMetricsRead(BaseModel):
    book_id: int
    play_count: int
    complete_count: int
    favorite_count: int
    share_count: int
    completion_rate: float


class CreationFunnelMetricsRead(BaseModel):
    started: int
    story_selected: int
    generation_submitted: int
    generation_succeeded: int
    conversion_rate: float


class OperationDashboardRead(BaseModel):
    range_start: date | None = None
    range_end: date | None = None
    play_count: int
    complete_count: int
    favorite_count: int
    share_count: int
    creation_count: int
    subscription_count: int
    report_count: int
    moderation_pending_count: int
    top_books: list[BookMetricsRead] = Field(default_factory=list)
