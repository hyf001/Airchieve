from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.model.book import Book, BookPublishStatus
from app.model.recommendation import (
    RecommendationItem,
    RecommendationPage,
    RecommendationSlot,
    RecommendationStatus,
    RecommendationTargetType,
    RecommendationTopic,
    RecommendationTopicStatus,
)
from app.model.story import Story, StoryPublishStatus
from app.schema.book import BookSummary
from app.schema.recommendation import (
    RecommendationHomeRead,
    RecommendationItemRead,
    RecommendationSlotRead,
    RecommendationTargetRead,
    RecommendationTopicRead,
)
from app.schema.story import StorySummary


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _resolve_target(db: AsyncSession, item: RecommendationItem) -> RecommendationTargetRead | None:
    if item.target_type == RecommendationTargetType.BOOK:
        book = await db.get(Book, item.target_id)
        if book is None or book.publish_status != BookPublishStatus.PUBLISHED:
            return None
        return RecommendationTargetRead(target_type=item.target_type, book=BookSummary.model_validate(book))
    if item.target_type == RecommendationTargetType.STORY:
        story = await db.get(Story, item.target_id)
        if story is None or story.publish_status != StoryPublishStatus.PUBLISHED:
            return None
        return RecommendationTargetRead(target_type=item.target_type, story=StorySummary.model_validate(story))
    if item.target_type == RecommendationTargetType.TOPIC:
        topic = await db.get(RecommendationTopic, item.target_id)
        if topic is None or topic.status != RecommendationTopicStatus.PUBLISHED:
            return None
        return RecommendationTargetRead(target_type=item.target_type, topic=RecommendationTopicRead.model_validate(topic))
    return RecommendationTargetRead(target_type=item.target_type)


async def _slot_read(db: AsyncSession, slot: RecommendationSlot, *, include_inactive: bool = False) -> RecommendationSlotRead:
    now = _now()
    items: list[RecommendationItemRead] = []
    for item in sorted(slot.items, key=lambda value: value.sort_weight, reverse=True):
        if not include_inactive and item.status != RecommendationStatus.ACTIVE:
            continue
        if item.start_at and item.start_at > now:
            continue
        if item.end_at and item.end_at < now:
            continue
        target = await _resolve_target(db, item)
        if target is None:
            continue
        items.append(
            RecommendationItemRead(
                id=item.id,
                target_type=item.target_type,
                target_id=item.target_id,
                title_override=item.title_override,
                image_asset_id_override=item.image_asset_id_override,
                scene_ids=item.scene_ids or [],
                min_age=item.min_age,
                max_age=item.max_age,
                access_level_filter=item.access_level_filter,
                sort_weight=item.sort_weight,
                start_at=item.start_at,
                end_at=item.end_at,
                status=item.status,
                target=target,
            )
        )
    return RecommendationSlotRead(
        id=slot.id,
        code=slot.code,
        name=slot.name,
        page=slot.page,
        display_type=slot.display_type,
        rule_config=slot.rule_config or {},
        status=slot.status,
        items=items,
        created_at=slot.created_at,
        updated_at=slot.updated_at,
    )


async def get_recommendation_slot(db: AsyncSession, slot_code: str) -> RecommendationSlotRead:
    result = await db.execute(
        select(RecommendationSlot)
        .options(selectinload(RecommendationSlot.items))
        .where(RecommendationSlot.code == slot_code, RecommendationSlot.status == RecommendationStatus.ACTIVE)
    )
    slot = result.scalar_one_or_none()
    if slot is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="推荐位不存在")
    return await _slot_read(db, slot)


async def list_home_recommendations(db: AsyncSession) -> RecommendationHomeRead:
    result = await db.execute(
        select(RecommendationSlot)
        .options(selectinload(RecommendationSlot.items))
        .where(RecommendationSlot.page == RecommendationPage.HOME, RecommendationSlot.status == RecommendationStatus.ACTIVE)
        .order_by(RecommendationSlot.created_at.asc())
    )
    return RecommendationHomeRead(slots=[await _slot_read(db, slot) for slot in result.scalars().all()])


async def list_book_related(db: AsyncSession, book_id: int) -> RecommendationSlotRead:
    code = f"book:{book_id}:related"
    result = await db.execute(
        select(RecommendationSlot)
        .options(selectinload(RecommendationSlot.items))
        .where(RecommendationSlot.code == code, RecommendationSlot.status == RecommendationStatus.ACTIVE)
    )
    slot = result.scalar_one_or_none()
    if slot is not None:
        return await _slot_read(db, slot)
    return await get_recommendation_slot(db, "book_detail_related")
