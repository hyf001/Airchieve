from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.account_api import current_user_id, optional_current_user_id
from app.db.session import get_db
from app.schema.book import BookSummary
from app.schema.reading import (
    FavoriteRead,
    FavoriteToggleRequest,
    ReadingEventCreate,
    ReadingProgressRead,
    ReadingProgressUpsert,
    RecentReadSummary,
)
from app.service import reading

router = APIRouter()


@router.get("/recent", response_model=list[RecentReadSummary])
async def list_recent_reads(
    child_profile_id: int | None = None,
    limit: int = Query(default=10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> list[RecentReadSummary]:
    return await reading.list_recent_reads(db, user_id=user_id, child_profile_id=child_profile_id, limit=limit)


@router.get("/favorites", response_model=list[BookSummary])
async def list_favorites(
    child_profile_id: int | None = None,
    limit: int = Query(default=20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> list[BookSummary]:
    return await reading.list_favorites(db, user_id=user_id, child_profile_id=child_profile_id, limit=limit)


@router.post("/favorites/toggle", response_model=FavoriteRead)
async def toggle_favorite(
    payload: FavoriteToggleRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> FavoriteRead:
    return await reading.toggle_favorite(db, user_id=user_id, book_id=payload.book_id, payload=payload)


@router.get("/favorites/{book_id}", response_model=FavoriteRead | None)
async def get_favorite(
    book_id: int,
    child_profile_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> FavoriteRead | None:
    return await reading.get_favorite(db, user_id=user_id, book_id=book_id, child_profile_id=child_profile_id)


@router.get("/progress/{book_id}", response_model=ReadingProgressRead | None)
async def get_reading_progress(
    book_id: int,
    child_profile_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> ReadingProgressRead | None:
    return await reading.get_reading_progress(db, user_id=user_id, book_id=book_id, child_profile_id=child_profile_id)


@router.put("/progress/{book_id}", response_model=ReadingProgressRead)
async def save_reading_progress(
    book_id: int,
    payload: ReadingProgressUpsert,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> ReadingProgressRead:
    return await reading.save_reading_progress(db, user_id=user_id, book_id=book_id, payload=payload)


@router.post("/events", status_code=status.HTTP_204_NO_CONTENT)
async def record_play_event(
    payload: ReadingEventCreate,
    db: AsyncSession = Depends(get_db),
    user_id: int | None = Depends(optional_current_user_id),
) -> Response:
    await reading.record_play_event(db, user_id=user_id, book_id=payload.book_id, payload=payload)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
