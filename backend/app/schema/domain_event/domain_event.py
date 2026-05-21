from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.model.domain_event import DomainEventDeliveryStatus


class DomainEventCreate(BaseModel):
    event_type: str = Field(min_length=1, max_length=120)
    actor_type: str = Field(min_length=1, max_length=40)
    actor_id: int | None = None
    target_type: str = Field(min_length=1, max_length=80)
    target_id: int = Field(ge=1)
    payload: dict[str, object] = Field(default_factory=dict)
    idempotency_key: str | None = Field(default=None, max_length=160)
    occurred_at: datetime | None = None
    consumers: list[str] = Field(default_factory=list)


class DomainEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_type: str
    actor_type: str
    actor_id: int | None
    target_type: str
    target_id: int
    payload: dict[str, object]
    idempotency_key: str | None
    occurred_at: datetime
    created_at: datetime


class DomainEventDeliveryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_id: int
    consumer: str
    status: DomainEventDeliveryStatus
    retry_count: int
    last_error: str | None
    consumed_at: datetime | None
    created_at: datetime
    updated_at: datetime
