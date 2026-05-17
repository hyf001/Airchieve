from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.model.recommendation import RecommendationItem, RecommendationSlot, RecommendationStatus
from app.schema.recommendation import (
    RecommendationItemRead,
    RecommendationItemStatusUpdate,
    RecommendationItemWrite,
    RecommendationSlotCreate,
    RecommendationSlotRead,
    RecommendationSlotUpdate,
    RecommendationTargetRead,
)
from app.service.recommendation.recommendation_service import _resolve_target, _slot_read


async def create_recommendation_slot(db: AsyncSession, payload: RecommendationSlotCreate) -> RecommendationSlotRead:
    existing = await db.execute(select(RecommendationSlot).where(RecommendationSlot.code == payload.code))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="推荐位编码已存在")
    slot = RecommendationSlot(**payload.model_dump())
    db.add(slot)
    await db.commit()
    await db.refresh(slot)
    slot.items = []
    return await _slot_read(db, slot, include_inactive=True)


async def update_recommendation_slot(
    db: AsyncSession,
    slot_id: int,
    payload: RecommendationSlotUpdate,
) -> RecommendationSlotRead:
    result = await db.execute(
        select(RecommendationSlot).options(selectinload(RecommendationSlot.items)).where(RecommendationSlot.id == slot_id)
    )
    slot = result.scalar_one_or_none()
    if slot is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="推荐位不存在")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(slot, field, value)
    await db.commit()
    await db.refresh(slot)
    return await _slot_read(db, slot, include_inactive=True)


async def update_recommendation_items(
    db: AsyncSession,
    slot_id: int,
    items: list[RecommendationItemWrite],
) -> RecommendationSlotRead:
    result = await db.execute(
        select(RecommendationSlot).options(selectinload(RecommendationSlot.items)).where(RecommendationSlot.id == slot_id)
    )
    slot = result.scalar_one_or_none()
    if slot is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="推荐位不存在")
    slot.items.clear()
    for payload in items:
        slot.items.append(RecommendationItem(**payload.model_dump()))
    await db.commit()
    await db.refresh(slot)
    return await _slot_read(db, slot, include_inactive=True)


async def set_recommendation_item_status(
    db: AsyncSession,
    item_id: int,
    payload: RecommendationItemStatusUpdate,
) -> RecommendationItemRead:
    item = await db.get(RecommendationItem, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="推荐项不存在")
    item.status = payload.status
    await db.commit()
    await db.refresh(item)
    target = await _resolve_target(db, item)
    return RecommendationItemRead(
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
