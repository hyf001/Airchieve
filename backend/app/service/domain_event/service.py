from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.model.domain_event import DomainEvent, DomainEventDelivery, DomainEventDeliveryStatus
from app.schema.domain_event import DomainEventCreate, DomainEventRead


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _read(event: DomainEvent) -> DomainEventRead:
    return DomainEventRead.model_validate(event)


async def publish_event(db: AsyncSession, payload: DomainEventCreate) -> DomainEventRead:
    event = DomainEvent(
        event_type=payload.event_type,
        actor_type=payload.actor_type,
        actor_id=payload.actor_id,
        target_type=payload.target_type,
        target_id=payload.target_id,
        payload=payload.payload,
        idempotency_key=payload.idempotency_key,
        occurred_at=payload.occurred_at or _now(),
    )
    event.deliveries = [DomainEventDelivery(consumer=consumer) for consumer in sorted(set(payload.consumers))]
    db.add(event)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        if not payload.idempotency_key:
            raise
        existing = await db.scalar(select(DomainEvent).where(DomainEvent.idempotency_key == payload.idempotency_key))
        if existing is None:
            raise
        return _read(existing)
    await db.refresh(event)
    return _read(event)


async def list_pending_events(db: AsyncSession, *, consumer: str, limit: int = 50) -> list[DomainEventRead]:
    result = await db.execute(
        select(DomainEvent)
        .join(DomainEventDelivery)
        .options(selectinload(DomainEvent.deliveries))
        .where(
            DomainEventDelivery.consumer == consumer,
            DomainEventDelivery.status.in_([DomainEventDeliveryStatus.PENDING, DomainEventDeliveryStatus.FAILED]),
        )
        .order_by(DomainEvent.created_at.asc())
        .limit(limit)
    )
    return [_read(event) for event in result.scalars().unique().all()]


async def _get_delivery(db: AsyncSession, event_id: int, consumer: str) -> DomainEventDelivery:
    delivery = await db.scalar(
        select(DomainEventDelivery).where(
            DomainEventDelivery.event_id == event_id,
            DomainEventDelivery.consumer == consumer,
        )
    )
    if delivery is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="事件投递不存在")
    return delivery


async def mark_event_consumed(db: AsyncSession, *, event_id: int, consumer: str) -> None:
    delivery = await _get_delivery(db, event_id, consumer)
    delivery.status = DomainEventDeliveryStatus.CONSUMED
    delivery.consumed_at = _now()
    delivery.last_error = None
    await db.commit()


async def mark_event_failed(db: AsyncSession, *, event_id: int, consumer: str, error: str) -> None:
    delivery = await _get_delivery(db, event_id, consumer)
    delivery.status = DomainEventDeliveryStatus.FAILED
    delivery.retry_count += 1
    delivery.last_error = error[:2000]
    await db.commit()
