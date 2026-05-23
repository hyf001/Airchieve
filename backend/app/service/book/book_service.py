from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.model.book import Book, BookAccessLevel, BookContentStatus, BookModerationStatus, BookPage, BookPublishStatus
from app.schema.entitlement import AccessDecision
from app.schema.membership import EntitlementAccessLevel
from app.model.taxonomy import TaxonomyType
from app.schema.book import (
    BookDetailRead,
    BookDialogueRead,
    BookListRead,
    BookLearningCardRead,
    BookPageRead,
    BookPlayerOptions,
    BookPlayerPayload,
    BookReadingPromptRead,
    BookSimilarCreationRequest,
    BookSort,
    BookSummary,
    BookVoiceOption,
    SimilarCreationSessionRead,
)
from app.service import entitlement as entitlement_service
from app.service.taxonomy import validate_taxonomy_codes


def _book_summary(book: Book) -> BookSummary:
    return BookSummary.model_validate(book)


async def list_books(
    db: AsyncSession,
    *,
    q: str | None = None,
    theme_code: str | None = None,
    age_range_code: str | None = None,
    language: str | None = None,
    access_level: BookAccessLevel | None = None,
    sort: BookSort = BookSort.FEATURED,
    limit: int = 20,
    offset: int = 0,
) -> BookListRead:
    conditions = [
        Book.publish_status == BookPublishStatus.PUBLISHED,
        Book.moderation_status == BookModerationStatus.APPROVED,
    ]
    if q:
        pattern = f"%{q.strip()}%"
        conditions.append(or_(Book.title.ilike(pattern), Book.summary.ilike(pattern)))
    if language:
        conditions.append(Book.language == language)
    if access_level:
        conditions.append(Book.access_level == access_level)
    await validate_taxonomy_codes(db, TaxonomyType.AGE_RANGE, [age_range_code] if age_range_code else [])
    await validate_taxonomy_codes(db, TaxonomyType.THEME, [theme_code] if theme_code else [])

    stmt = select(Book).where(*conditions)
    count_stmt = select(func.count()).select_from(Book).where(*conditions)

    if theme_code is not None:
        # JSON array containment differs per database; filtering in memory keeps MVP portable.
        stmt = stmt.order_by(Book.is_featured.desc())
    if age_range_code is not None:
        stmt = stmt.order_by(Book.is_featured.desc())

    if sort == BookSort.NEWEST:
        stmt = stmt.order_by(Book.created_at.desc())
    elif sort == BookSort.POPULAR:
        stmt = stmt.order_by(Book.play_count.desc(), Book.created_at.desc())
    else:
        stmt = stmt.order_by(Book.is_featured.desc(), Book.play_count.desc(), Book.created_at.desc())

    result = await db.execute(stmt.offset(offset).limit(limit))
    rows = result.scalars().all()
    if theme_code is not None:
        rows = [book for book in rows if theme_code in (book.theme_codes or [])]
    if age_range_code is not None:
        rows = [book for book in rows if age_range_code in (book.age_range_codes or [])]
    total = await db.scalar(count_stmt)
    return BookListRead(items=[_book_summary(book) for book in rows], total=total or 0, limit=limit, offset=offset)


async def list_user_books(
    db: AsyncSession,
    *,
    user_id: int,
    limit: int = 20,
    offset: int = 0,
) -> BookListRead:
    conditions = [
        Book.owner_user_id == user_id,
        Book.publish_status != BookPublishStatus.DELETED,
    ]
    stmt = select(Book).where(*conditions).order_by(Book.created_at.desc())
    count_stmt = select(func.count()).select_from(Book).where(*conditions)
    result = await db.execute(stmt.offset(offset).limit(limit))
    rows = result.scalars().all()
    total = await db.scalar(count_stmt)
    return BookListRead(items=[_book_summary(book) for book in rows], total=total or 0, limit=limit, offset=offset)


async def get_book_detail(db: AsyncSession, book_id: int, user_id: int | None = None) -> BookDetailRead:
    book = await db.get(Book, book_id)
    owner_can_view = user_id is not None and book is not None and book.owner_user_id == user_id
    if (
        book is None
        or book.publish_status != BookPublishStatus.PUBLISHED
        or (book.moderation_status != BookModerationStatus.APPROVED and not owner_can_view)
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="绘本不存在")
    return await _book_detail_read(db, book)


async def _book_detail_read(db: AsyncSession, book: Book) -> BookDetailRead:
    related = await _list_related_books_for_book(db, book, limit=6)
    return BookDetailRead(
        **_book_summary(book).model_dump(),
        source_story_id=book.source_story_id,
        narrative_style_code=book.narrative_style_code,
        art_style_code=book.art_style_code,
        publish_status=book.publish_status,
        is_featured=book.is_featured,
        created_at=book.created_at,
        updated_at=book.updated_at,
        related_books=related,
    )


async def _get_book_for_player(db: AsyncSession, book_id: int, user_id: int | None = None) -> Book:
    result = await db.execute(
        select(Book)
        .options(
            selectinload(Book.pages).selectinload(BookPage.dialogues),
            selectinload(Book.reading_prompts),
            selectinload(Book.learning_cards),
        )
        .where(Book.id == book_id)
    )
    book = result.scalar_one_or_none()
    owner_can_view = user_id is not None and book is not None and book.owner_user_id == user_id
    if (
        book is None
        or book.publish_status != BookPublishStatus.PUBLISHED
        or (book.moderation_status != BookModerationStatus.APPROVED and not owner_can_view)
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="绘本不存在")
    return book


def _fallback_pages(book: Book) -> list[BookPageRead]:
    page_count = max(book.page_count, 1)
    pages: list[BookPageRead] = []
    for index in range(page_count):
        page_no = index + 1
        pages.append(
            BookPageRead(
                id=-(page_no),
                page_no=page_no,
                title=book.title if page_no == 1 else None,
                text_zh=book.summary or f"{book.title} 第 {page_no} 页",
                text_en=None,
                narration_text=book.summary or book.title,
                visual_prompt=book.summary,
                image_url=book.cover_url if page_no == 1 else None,
                video_url=None,
                audio_url=None,
                background_music_url=None,
                duration_seconds=max(12, round(book.duration_seconds / page_count)),
                lip_sync_status="none",
                dialogues=[],
            )
        )
    return pages


def _page_read(page: BookPage) -> BookPageRead:
    return BookPageRead(
        id=page.id,
        page_no=page.page_no,
        title=page.title,
        text_zh=page.text_zh,
        text_en=page.text_en,
        narration_text=page.narration_text,
        visual_prompt=page.visual_prompt,
        image_url=page.image_url,
        video_url=page.video_url,
        audio_url=page.audio_url,
        background_music_url=page.background_music_url,
        sound_effect_urls=page.sound_effect_urls or [],
        duration_seconds=page.duration_seconds,
        lip_sync_status=page.lip_sync_status,
        dialogues=[
            BookDialogueRead(
                id=dialogue.id,
                character_ref=dialogue.character_ref,
                text=dialogue.text,
                audio_url=dialogue.audio_url,
                start_ms=dialogue.start_ms,
                end_ms=dialogue.end_ms,
                lip_sync_url=dialogue.lip_sync_url,
                sort_order=dialogue.sort_order,
            )
            for dialogue in page.dialogues
        ],
    )


def _voice_options_for_book(book: Book) -> tuple[BookVoiceOption | None, list[BookVoiceOption]]:
    if book.default_voice_name is None:
        return None, []
    default_voice = BookVoiceOption(id=book.default_voice_id, name=book.default_voice_name, source="book")
    return default_voice, [default_voice]


async def get_player_payload(
    db: AsyncSession,
    *,
    book_id: int,
    user_id: int | None = None,
    options: BookPlayerOptions | None = None,
) -> BookPlayerPayload:
    book = await _get_book_for_player(db, book_id, user_id=user_id)
    detail = await _book_detail_read(db, book)
    access_decision: AccessDecision | None = None
    can_read_full_book = book.access_level == BookAccessLevel.FREE
    preview_page_count = None
    if book.access_level == BookAccessLevel.PREVIEW:
        preview_page_count = max(1, book.preview_page_count)
    if book.access_level == BookAccessLevel.VIP:
        if user_id is not None:
            access_decision = await entitlement_service.can_access_book(db, user_id, str(book_id))
            can_read_full_book = access_decision.allowed
        else:
            access_decision = AccessDecision(
                allowed=False,
                access_level=EntitlementAccessLevel.FREE,
                preview_pages=book.preview_page_count,
                reason_code="login_required",
                upgrade_required=True,
            )
        if not can_read_full_book:
            preview_page_count = max(1, book.preview_page_count)
    pages = [_page_read(page) for page in book.pages] if book.pages else _fallback_pages(book)
    if preview_page_count is not None:
        pages = pages[:preview_page_count]
    visible_prompts = [
        BookReadingPromptRead(
            id=prompt.id,
            prompt_type=prompt.prompt_type,
            content=prompt.content,
            page_no=prompt.page_no,
            status=prompt.status,
            sort_order=prompt.sort_order,
        )
        for prompt in book.reading_prompts
        if prompt.status == BookContentStatus.VISIBLE
    ]
    visible_cards = [
        BookLearningCardRead(
            id=card.id,
            theme=card.theme,
            education_goals=card.education_goals or [],
            vocabulary=card.vocabulary or [],
            discussion_questions=card.discussion_questions or [],
            status=card.status,
            sort_order=card.sort_order,
        )
        for card in book.learning_cards
        if card.status == BookContentStatus.VISIBLE
    ]
    default_voice, voice_options = _voice_options_for_book(book)
    return BookPlayerPayload(
        book=detail,
        pages=pages,
        reading_prompts=visible_prompts,
        learning_cards=visible_cards,
        access_decision=access_decision,
        can_read_full_book=can_read_full_book,
        preview_page_count=preview_page_count,
        default_text_mode=options.text_mode if options and options.text_mode else book.language,
        default_voice=default_voice,
        voice_options=voice_options,
    )


async def list_related_books(db: AsyncSession, book_id: int, *, limit: int = 8) -> list[BookSummary]:
    book = await db.get(Book, book_id)
    if book is None:
        return []
    return await _list_related_books_for_book(db, book, limit=limit)


async def _list_related_books_for_book(db: AsyncSession, book: Book, *, limit: int = 8) -> list[BookSummary]:
    result = await db.execute(
        select(Book)
        .where(Book.id != book.id, Book.publish_status == BookPublishStatus.PUBLISHED)
        .order_by(Book.is_featured.desc(), Book.play_count.desc(), Book.created_at.desc())
        .limit(limit * 2)
    )
    books = result.scalars().all()
    if book.theme_codes:
        prioritized = sorted(
            books,
            key=lambda item: len(set(item.theme_codes or []).intersection(book.theme_codes or [])),
            reverse=True,
        )
    else:
        prioritized = books
    return [_book_summary(item) for item in prioritized[:limit]]


async def adjust_book_favorite_count(db: AsyncSession, *, book: Book, delta: int) -> None:
    book.favorite_count = max(0, book.favorite_count + delta)


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
        prefilled_theme_codes=book.theme_codes or [],
        prefilled_age_range_codes=book.age_range_codes or [],
        prefilled_education_goal_codes=book.education_goal_codes or [],
        prefilled_page_count=book.page_count,
        prefilled_art_style_code=book.art_style_code,
        guidance="已带入主题、适龄、页数和画风作为参考；后续生成不会复制原绘本文字和图片。",
    )
