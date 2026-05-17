from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schema.recommendation import RecommendationHomeRead, RecommendationSlotRead
from app.service import recommendation

router = APIRouter()


@router.get("/home", response_model=RecommendationHomeRead)
async def list_home_recommendations(db: AsyncSession = Depends(get_db)) -> RecommendationHomeRead:
    return await recommendation.list_home_recommendations(db)


@router.get("/book/{book_id}/related", response_model=RecommendationSlotRead)
async def list_related_recommendations(book_id: int, db: AsyncSession = Depends(get_db)) -> RecommendationSlotRead:
    return await recommendation.list_book_related(db, book_id)


@router.get("/{slot_code}", response_model=RecommendationSlotRead)
async def get_recommendation_slot(slot_code: str, db: AsyncSession = Depends(get_db)) -> RecommendationSlotRead:
    return await recommendation.get_recommendation_slot(db, slot_code)
