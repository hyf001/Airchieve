from datetime import date, datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.model.analytics import AnalyticsActorType, AnalyticsEvent
from app.model.book import Book
from app.model.moderation import ModerationRecord, ModerationStatus, Report
from app.model.reading import ReadingEvent, ReadingEventType, ReadingFavorite, ReadingFavoriteStatus
from app.model.share import ShareLink
from app.schema.analytics import (
    AnalyticsEventCreate,
    AnalyticsEventRead,
    BookMetricsRead,
    CreationFunnelMetricsRead,
    OperationDashboardRead,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def track_event(db: AsyncSession, payload: AnalyticsEventCreate) -> AnalyticsEventRead:
    event = AnalyticsEvent(
        event_type=payload.event_type,
        actor_type=payload.actor_type,
        actor_id=payload.actor_id,
        target_type=payload.target_type,
        target_id=payload.target_id,
        session_id=payload.session_id,
        payload=payload.payload,
        occurred_at=payload.occurred_at or _now(),
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return AnalyticsEventRead.model_validate(event)


async def track_client_event(
    db: AsyncSession,
    *,
    user_id: int | None,
    payload: AnalyticsEventCreate,
) -> AnalyticsEventRead:
    payload.actor_type = AnalyticsActorType.USER if user_id is not None else AnalyticsActorType.ANONYMOUS
    payload.actor_id = user_id
    return await track_event(db, payload)


async def get_book_metrics(db: AsyncSession, book_id: int) -> BookMetricsRead:
    play_count = await db.scalar(
        select(func.count()).select_from(ReadingEvent).where(ReadingEvent.book_id == book_id, ReadingEvent.event_type == ReadingEventType.PLAY_START)
    )
    complete_count = await db.scalar(
        select(func.count()).select_from(ReadingEvent).where(ReadingEvent.book_id == book_id, ReadingEvent.event_type == ReadingEventType.COMPLETE)
    )
    favorite_count = await db.scalar(
        select(func.count()).select_from(ReadingFavorite).where(
            ReadingFavorite.book_id == book_id,
            ReadingFavorite.status == ReadingFavoriteStatus.ACTIVE,
        )
    )
    share_count = await db.scalar(select(func.count()).select_from(ShareLink).where(ShareLink.book_id == book_id))
    plays = int(play_count or 0)
    completes = int(complete_count or 0)
    return BookMetricsRead(
        book_id=book_id,
        play_count=plays,
        complete_count=completes,
        favorite_count=int(favorite_count or 0),
        share_count=int(share_count or 0),
        completion_rate=round(completes / plays, 4) if plays else 0,
    )


async def get_creation_funnel_metrics(db: AsyncSession) -> CreationFunnelMetricsRead:
    started = await db.scalar(select(func.count()).select_from(AnalyticsEvent).where(AnalyticsEvent.event_type == "creation_started"))
    story_selected = await db.scalar(select(func.count()).select_from(AnalyticsEvent).where(AnalyticsEvent.event_type == "creation_story_selected"))
    generation_submitted = await db.scalar(select(func.count()).select_from(AnalyticsEvent).where(AnalyticsEvent.event_type == "generation_submitted"))
    generation_succeeded = await db.scalar(select(func.count()).select_from(AnalyticsEvent).where(AnalyticsEvent.event_type == "generation_succeeded"))
    submitted = int(generation_submitted or 0)
    succeeded = int(generation_succeeded or 0)
    return CreationFunnelMetricsRead(
        started=int(started or 0),
        story_selected=int(story_selected or 0),
        generation_submitted=submitted,
        generation_succeeded=succeeded,
        conversion_rate=round(succeeded / submitted, 4) if submitted else 0,
    )


async def get_operation_dashboard(
    db: AsyncSession,
    *,
    range_start: date | None = None,
    range_end: date | None = None,
) -> OperationDashboardRead:
    play_count = await db.scalar(select(func.count()).select_from(ReadingEvent).where(ReadingEvent.event_type == ReadingEventType.PLAY_START))
    complete_count = await db.scalar(select(func.count()).select_from(ReadingEvent).where(ReadingEvent.event_type == ReadingEventType.COMPLETE))
    favorite_count = await db.scalar(select(func.count()).select_from(ReadingFavorite).where(ReadingFavorite.status == ReadingFavoriteStatus.ACTIVE))
    share_count = await db.scalar(select(func.count()).select_from(ShareLink))
    creation_count = await db.scalar(select(func.count()).select_from(AnalyticsEvent).where(AnalyticsEvent.event_type.like("creation_%")))
    subscription_count = await db.scalar(select(func.count()).select_from(AnalyticsEvent).where(AnalyticsEvent.event_type.like("subscription_%")))
    report_count = await db.scalar(select(func.count()).select_from(Report))
    moderation_pending_count = await db.scalar(
        select(func.count()).select_from(ModerationRecord).where(ModerationRecord.status == ModerationStatus.PENDING)
    )
    top_book_rows = await db.execute(select(Book.id).order_by(Book.play_count.desc(), Book.updated_at.desc()).limit(5))
    top_books = [await get_book_metrics(db, book_id) for book_id in top_book_rows.scalars().all()]
    return OperationDashboardRead(
        range_start=range_start,
        range_end=range_end,
        play_count=int(play_count or 0),
        complete_count=int(complete_count or 0),
        favorite_count=int(favorite_count or 0),
        share_count=int(share_count or 0),
        creation_count=int(creation_count or 0),
        subscription_count=int(subscription_count or 0),
        report_count=int(report_count or 0),
        moderation_pending_count=int(moderation_pending_count or 0),
        top_books=top_books,
    )
