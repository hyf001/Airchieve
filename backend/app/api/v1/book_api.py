from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.account_api import current_user_id, optional_current_user_id
from app.db.session import get_db
from app.model.book import BookAccessLevel
from app.schema.book import (
    BookDetailRead,
    BookListRead,
    BookPlayerOptions,
    BookPlayerPayload,
    BookSimilarCreationRequest,
    BookSort,
    SimilarCreationSessionRead,
)
from app.service import book

router = APIRouter()


@router.get("", response_model=BookListRead)
async def list_books(
    q: str | None = None,
    theme_code: str | None = None,
    age_range_code: str | None = None,
    language: str | None = None,
    access_level: BookAccessLevel | None = None,
    sort: BookSort = BookSort.FEATURED,
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> BookListRead:
    return await book.list_books(
        db,
        q=q,
        theme_code=theme_code,
        age_range_code=age_range_code,
        language=language,
        access_level=access_level,
        sort=sort,
        limit=limit,
        offset=offset,
    )


@router.get("/{book_id}", response_model=BookDetailRead)
async def get_book_detail(book_id: int, db: AsyncSession = Depends(get_db)) -> BookDetailRead:
    return await book.get_book_detail(db, book_id)


@router.get("/{book_id}/player", response_model=BookPlayerPayload)
async def get_book_player_payload(
    book_id: int,
    child_profile_id: int | None = None,
    text_mode: str | None = None,
    voice_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user_id: int | None = Depends(optional_current_user_id),
) -> BookPlayerPayload:
    return await book.get_player_payload(
        db,
        book_id=book_id,
        user_id=user_id,
        options=BookPlayerOptions(child_profile_id=child_profile_id, text_mode=text_mode, voice_id=voice_id),
    )


@router.post("/{book_id}/similar-creation-session", response_model=SimilarCreationSessionRead)
async def create_similar_creation_session(
    book_id: int,
    payload: BookSimilarCreationRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> SimilarCreationSessionRead:
    return await book.create_session_from_book_reference(
        db,
        user_id=user_id,
        book_id=book_id,
        payload=payload,
    )
