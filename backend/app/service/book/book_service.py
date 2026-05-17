from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.model.book import Book, BookAccessLevel, BookPublishStatus
from app.schema.book import (
    BookDetailRead,
    BookListRead,
    BookSimilarCreationRequest,
    BookSort,
    BookSummary,
    SimilarCreationSessionRead,
)


def _book_summary(book: Book) -> BookSummary:
    return BookSummary.model_validate(book)


async def list_books(
    db: AsyncSession,
    *,
    q: str | None = None,
    theme_id: int | None = None,
    age_range_id: int | None = None,
    language: str | None = None,
    access_level: BookAccessLevel | None = None,
    sort: BookSort = BookSort.FEATURED,
    limit: int = 20,
    offset: int = 0,
) -> BookListRead:
    conditions = [Book.publish_status == BookPublishStatus.PUBLISHED]
    if q:
        pattern = f"%{q.strip()}%"
        conditions.append(or_(Book.title.ilike(pattern), Book.summary.ilike(pattern)))
    if language:
        conditions.append(Book.language == language)
    if access_level:
        conditions.append(Book.access_level == access_level)

    stmt = select(Book).where(*conditions)
    count_stmt = select(func.count()).select_from(Book).where(*conditions)

    if theme_id is not None:
        # JSON array containment differs per database; filtering in memory keeps MVP portable.
        stmt = stmt.order_by(Book.is_featured.desc())
    if age_range_id is not None:
        stmt = stmt.order_by(Book.is_featured.desc())

    if sort == BookSort.NEWEST:
        stmt = stmt.order_by(Book.created_at.desc())
    elif sort == BookSort.POPULAR:
        stmt = stmt.order_by(Book.play_count.desc(), Book.created_at.desc())
    else:
        stmt = stmt.order_by(Book.is_featured.desc(), Book.play_count.desc(), Book.created_at.desc())

    result = await db.execute(stmt.offset(offset).limit(limit))
    rows = result.scalars().all()
    if theme_id is not None:
        rows = [book for book in rows if theme_id in (book.theme_ids or [])]
    if age_range_id is not None:
        rows = [book for book in rows if age_range_id in (book.age_range_ids or [])]
    total = await db.scalar(count_stmt)
    return BookListRead(items=[_book_summary(book) for book in rows], total=total or 0, limit=limit, offset=offset)


async def get_book_detail(db: AsyncSession, book_id: int, user_id: int | None = None) -> BookDetailRead:
    book = await db.get(Book, book_id)
    if book is None or book.publish_status != BookPublishStatus.PUBLISHED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="绘本不存在")
    related = await list_related_books(db, book_id, limit=6)
    return BookDetailRead(
        **_book_summary(book).model_dump(),
        source_story_id=book.source_story_id,
        narrative_style_id=book.narrative_style_id,
        art_style_id=book.art_style_id,
        publish_status=book.publish_status,
        is_featured=book.is_featured,
        created_at=book.created_at,
        updated_at=book.updated_at,
        related_books=related,
    )


async def list_related_books(db: AsyncSession, book_id: int, *, limit: int = 8) -> list[BookSummary]:
    book = await db.get(Book, book_id)
    if book is None:
        return []
    result = await db.execute(
        select(Book)
        .where(Book.id != book_id, Book.publish_status == BookPublishStatus.PUBLISHED)
        .order_by(Book.is_featured.desc(), Book.play_count.desc(), Book.created_at.desc())
        .limit(limit * 2)
    )
    books = result.scalars().all()
    if book.theme_ids:
        prioritized = sorted(
            books,
            key=lambda item: len(set(item.theme_ids or []).intersection(book.theme_ids or [])),
            reverse=True,
        )
    else:
        prioritized = books
    return [_book_summary(item) for item in prioritized[:limit]]


async def create_session_from_book_reference(
    db: AsyncSession,
    *,
    user_id: int,
    book_id: int,
    payload: BookSimilarCreationRequest,
) -> SimilarCreationSessionRead:
    book = await db.get(Book, book_id)
    if book is None or book.publish_status != BookPublishStatus.PUBLISHED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="绘本不存在")
    return SimilarCreationSessionRead(
        source_book_id=book.id,
        source_title=book.title,
        prefilled_theme_ids=book.theme_ids or [],
        prefilled_age_range_ids=book.age_range_ids or [],
        prefilled_education_goal_ids=book.education_goal_ids or [],
        prefilled_page_count=book.page_count,
        prefilled_art_style_id=book.art_style_id,
        guidance="已带入主题、适龄、页数和画风作为参考；后续生成不会复制原绘本文字和图片。",
    )
