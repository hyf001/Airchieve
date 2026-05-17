from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schema.recommendation import (
    RecommendationItemRead,
    RecommendationItemStatusUpdate,
    RecommendationItemWrite,
    RecommendationSlotCreate,
    RecommendationSlotRead,
    RecommendationSlotUpdate,
)
from app.service import recommendation

router = APIRouter()


@router.post("/recommendation/slots", response_model=RecommendationSlotRead)
async def create_recommendation_slot(
    payload: RecommendationSlotCreate,
    db: AsyncSession = Depends(get_db),
) -> RecommendationSlotRead:
    return await recommendation.create_recommendation_slot(db, payload)


@router.patch("/recommendation/slots/{slot_id}", response_model=RecommendationSlotRead)
async def update_recommendation_slot(
    slot_id: int,
    payload: RecommendationSlotUpdate,
    db: AsyncSession = Depends(get_db),
) -> RecommendationSlotRead:
    return await recommendation.update_recommendation_slot(db, slot_id, payload)


@router.put("/recommendation/slots/{slot_id}/items", response_model=RecommendationSlotRead)
async def update_recommendation_items(
    slot_id: int,
    payload: list[RecommendationItemWrite],
    db: AsyncSession = Depends(get_db),
) -> RecommendationSlotRead:
    return await recommendation.update_recommendation_items(db, slot_id, payload)


@router.patch("/recommendation/items/{item_id}/status", response_model=RecommendationItemRead)
async def set_recommendation_item_status(
    item_id: int,
    payload: RecommendationItemStatusUpdate,
    db: AsyncSession = Depends(get_db),
) -> RecommendationItemRead:
    return await recommendation.set_recommendation_item_status(db, item_id, payload)
