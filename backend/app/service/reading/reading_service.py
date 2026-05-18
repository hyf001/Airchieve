from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.model.book import Book, BookPublishStatus
from app.model.reading import ReadingEvent, ReadingFavorite, ReadingFavoriteStatus, ReadingProgress
from app.schema.book import BookSummary
from app.schema.reading import (
    FavoriteRead,
    FavoriteToggleRequest,
    ReadingEventCreate,
    ReadingProgressRead,
    ReadingProgressUpsert,
    RecentReadSummary,
)
from app.service.account.child_profile_service import assert_profile_belongs_to_user
from app.service.book import adjust_book_favorite_count


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _assert_book_readable(db: AsyncSession, book_id: int) -> Book:
    book = await db.get(Book, book_id)
    if book is None or book.publish_status != BookPublishStatus.PUBLISHED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="绘本不存在")
    return book


async def _assert_profile(db: AsyncSession, user_id: int, child_profile_id: int | None) -> None:
    if child_profile_id is not None:
        await assert_profile_belongs_to_user(db, child_profile_id, user_id)


def _progress_read(progress: ReadingProgress) -> ReadingProgressRead:
    return ReadingProgressRead(
        id=progress.id,
        book_id=progress.book_id,
        child_profile_id=progress.child_profile_id,
        current_page_no=progress.current_page_no,
        current_position_ms=progress.current_position_ms,
        progress_percent=float(progress.progress_percent),
        mode=progress.mode,
        text_mode=progress.text_mode,
        voice_id=progress.voice_id,
        last_read_at=progress.last_read_at,
        completed_at=progress.completed_at,
    )


def _apply_progress_update(
    progress: ReadingProgress,
    *,
    page_no: int,
    payload: ReadingProgressUpsert,
    completed_at: datetime | None,
) -> None:
    progress.current_page_no = page_no
    progress.current_position_ms = payload.current_position_ms
    progress.progress_percent = payload.progress_percent
    progress.mode = payload.mode
    progress.text_mode = payload.text_mode
    progress.voice_id = payload.voice_id
    progress.last_read_at = _now()
    progress.completed_at = completed_at or progress.completed_at


def _favorite_read(favorite: ReadingFavorite) -> FavoriteRead:
    return FavoriteRead(
        id=favorite.id,
        book_id=favorite.book_id,
        child_profile_id=favorite.child_profile_id,
        status=favorite.status,
        is_favorite=favorite.status == ReadingFavoriteStatus.ACTIVE,
        created_at=favorite.created_at,
        updated_at=favorite.updated_at,
    )


async def _get_progress_row(
    db: AsyncSession,
    *,
    user_id: int,
    book_id: int,
    child_profile_id: int | None,
) -> ReadingProgress | None:
    result = await db.execute(
        select(ReadingProgress).where(
            ReadingProgress.user_id == user_id,
            ReadingProgress.book_id == book_id,
            ReadingProgress.child_profile_id == child_profile_id,
        )
    )
    return result.scalar_one_or_none()


async def get_favorite(
    db: AsyncSession,
    *,
    user_id: int,
    book_id: int,
    child_profile_id: int | None = None,
) -> FavoriteRead | None:
    await _assert_profile(db, user_id, child_profile_id)
    await _assert_book_readable(db, book_id)
    favorite = await _get_favorite_row(db, user_id=user_id, book_id=book_id, child_profile_id=child_profile_id)
    return _favorite_read(favorite) if favorite else None


async def get_reading_progress(
    db: AsyncSession,
    *,
    user_id: int,
    book_id: int,
    child_profile_id: int | None = None,
) -> ReadingProgressRead | None:
    await _assert_profile(db, user_id, child_profile_id)
    await _assert_book_readable(db, book_id)
    progress = await _get_progress_row(db, user_id=user_id, book_id=book_id, child_profile_id=child_profile_id)
    return _progress_read(progress) if progress else None


async def save_reading_progress(
    db: AsyncSession,
    *,
    user_id: int,
    book_id: int,
    payload: ReadingProgressUpsert,
) -> ReadingProgressRead:
    book = await _assert_book_readable(db, book_id)
    await _assert_profile(db, user_id, payload.child_profile_id)
    page_no = min(payload.current_page_no, max(book.page_count, 1))
    completed_at = _now() if payload.completed or payload.progress_percent >= 99 else None
    progress = await _get_progress_row(
        db,
        user_id=user_id,
        book_id=book_id,
        child_profile_id=payload.child_profile_id,
    )
    if progress is None:
        progress = ReadingProgress(user_id=user_id, book_id=book_id, child_profile_id=payload.child_profile_id)
        db.add(progress)
    _apply_progress_update(progress, page_no=page_no, payload=payload, completed_at=completed_at)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        progress = await _get_progress_row(
            db,
            user_id=user_id,
            book_id=book_id,
            child_profile_id=payload.child_profile_id,
        )
        if progress is None:
            raise
        _apply_progress_update(progress, page_no=page_no, payload=payload, completed_at=completed_at)
        await db.commit()
    await db.refresh(progress)
    return _progress_read(progress)


async def list_recent_reads(
    db: AsyncSession,
    *,
    user_id: int,
    child_profile_id: int | None = None,
    limit: int = 10,
) -> list[RecentReadSummary]:
    await _assert_profile(db, user_id, child_profile_id)
    result = await db.execute(
        select(ReadingProgress)
        .options(selectinload(ReadingProgress.book))
        .where(
            ReadingProgress.user_id == user_id,
            ReadingProgress.child_profile_id == child_profile_id,
        )
        .order_by(ReadingProgress.last_read_at.desc())
        .limit(limit)
    )
    rows = result.scalars().all()
    return [
        RecentReadSummary(progress=_progress_read(row), book=BookSummary.model_validate(row.book))
        for row in rows
        if row.book and row.book.publish_status == BookPublishStatus.PUBLISHED
    ]


async def _get_favorite_row(
    db: AsyncSession,
    *,
    user_id: int,
    book_id: int,
    child_profile_id: int | None,
) -> ReadingFavorite | None:
    result = await db.execute(
        select(ReadingFavorite).where(
            ReadingFavorite.user_id == user_id,
            ReadingFavorite.book_id == book_id,
            ReadingFavorite.child_profile_id == child_profile_id,
        )
    )
    return result.scalar_one_or_none()


async def toggle_favorite(
    db: AsyncSession,
    *,
    user_id: int,
    book_id: int,
    payload: FavoriteToggleRequest,
) -> FavoriteRead:
    book = await _assert_book_readable(db, book_id)
    await _assert_profile(db, user_id, payload.child_profile_id)
    favorite = await _get_favorite_row(
        db,
        user_id=user_id,
        book_id=book_id,
        child_profile_id=payload.child_profile_id,
    )
    was_active = favorite is not None and favorite.status == ReadingFavoriteStatus.ACTIVE
    next_status = payload.desired_status
    if next_status is None:
        next_status = ReadingFavoriteStatus.DELETED if was_active else ReadingFavoriteStatus.ACTIVE
    if favorite is None:
        favorite = ReadingFavorite(
            user_id=user_id,
            child_profile_id=payload.child_profile_id,
            book_id=book_id,
            status=next_status,
        )
        db.add(favorite)
    else:
        favorite.status = next_status
    is_active = next_status == ReadingFavoriteStatus.ACTIVE
    if was_active != is_active:
        await adjust_book_favorite_count(db, book=book, delta=1 if is_active else -1)
    await db.commit()
    await db.refresh(favorite)
    return _favorite_read(favorite)


async def list_favorites(
    db: AsyncSession,
    *,
    user_id: int,
    child_profile_id: int | None = None,
    limit: int = 20,
) -> list[BookSummary]:
    await _assert_profile(db, user_id, child_profile_id)
    result = await db.execute(
        select(ReadingFavorite)
        .options(selectinload(ReadingFavorite.book))
        .where(
            ReadingFavorite.user_id == user_id,
            ReadingFavorite.child_profile_id == child_profile_id,
            ReadingFavorite.status == ReadingFavoriteStatus.ACTIVE,
        )
        .order_by(ReadingFavorite.updated_at.desc())
        .limit(limit)
    )
    return [
        BookSummary.model_validate(row.book)
        for row in result.scalars().all()
        if row.book and row.book.publish_status == BookPublishStatus.PUBLISHED
    ]


async def record_play_event(
    db: AsyncSession,
    *,
    user_id: int | None,
    book_id: int,
    payload: ReadingEventCreate,
) -> None:
    book = await _assert_book_readable(db, book_id)
    if user_id is not None:
        await _assert_profile(db, user_id, payload.child_profile_id)
    event = ReadingEvent(
        user_id=user_id,
        child_profile_id=payload.child_profile_id,
        book_id=book_id,
        event_type=payload.event_type,
        page_no=payload.page_no,
        position_ms=payload.position_ms,
        payload=payload.payload,
        occurred_at=payload.occurred_at or _now(),
    )
    db.add(event)
    if payload.event_type.value == "play_start":
        book.play_count += 1
    await db.commit()
