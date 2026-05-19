from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.model.book import Book, BookLanguage, BookModerationStatus, BookPage, BookPublishStatus, BookSourceType
from app.model.creation import (
    CreationSession,
    CreationSessionStatus,
    CreationStep,
    CreationStoryboardPage,
    CreationType,
    StoryboardGenerationStatus,
)
from app.model.generation_task import GenerationTaskType
from app.schema.creation import (
    CreationConfigPatch,
    CreationSessionCreate,
    CreationSessionRead,
    CreationTaskResponse,
    GeneratePagesRequest,
    IdeaStoryGenerateRequest,
    RegenerateRequest,
    SaveBookResponse,
    StoryboardPagePatch,
    TASK_TYPE_BY_REGENERATE_TARGET,
)
from app.schema.generation_task import GenerationTaskCreate, GenerationTaskRead
from app.service import ai_provider
from app.service import account as account_service
from app.service import book as book_service
from app.service import generation_task
from app.service import story as story_service
from app.service import template as template_service


def _session_read(session: CreationSession) -> CreationSessionRead:
    return CreationSessionRead.model_validate(session)


async def create_session(db: AsyncSession, user_id: int, payload: CreationSessionCreate) -> CreationSessionRead:
    if payload.child_profile_id is not None:
        await account_service.assert_profile_belongs_to_user(db, payload.child_profile_id, user_id)
    if payload.story_id is not None:
        await story_service.assert_story_usable(db, user_id, payload.story_id)
    if payload.template_id is not None:
        await template_service.get_template(db, payload.template_id)
    if payload.reference_book_id is not None:
        await book_service.get_book_detail(db, payload.reference_book_id, user_id)
    session = CreationSession(
        user_id=user_id,
        child_profile_id=payload.child_profile_id,
        creation_type=payload.creation_type,
        current_step=CreationStep.TEMPLATE if payload.creation_type == CreationType.TEMPLATE_BOOK else CreationStep.STORY,
        story_source_type=payload.story_source_type,
        story_id=payload.story_id,
        template_id=payload.template_id,
        reference_book_id=payload.reference_book_id,
        language=payload.language,
        target_page_count=payload.target_page_count,
        age_range_codes=payload.age_range_codes,
        theme_codes=payload.theme_codes,
        education_goal_codes=payload.education_goal_codes,
        narrative_style_code=payload.narrative_style_code,
    )
    db.add(session)
    await db.commit()
    return await get_session(db, user_id, session.id)


async def get_session(db: AsyncSession, user_id: int, session_id: int) -> CreationSessionRead:
    session = await _get_session_model(db, user_id, session_id)
    return _session_read(session)


async def update_session_config(
    db: AsyncSession,
    user_id: int,
    session_id: int,
    payload: CreationConfigPatch,
) -> CreationSessionRead:
    session = await _get_session_model(db, user_id, session_id)
    data = payload.model_dump(exclude_unset=True, mode="json")
    if session.creation_type == CreationType.TEMPLATE_BOOK and "art_style_ref" in data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="TEMPLATE_CONTENT_LOCKED")
    for field, value in data.items():
        setattr(session, field, value)
    if payload.character_refs is not None:
        session.current_step = CreationStep.ART_STYLE if session.creation_type != CreationType.TEMPLATE_BOOK else CreationStep.VOICE
    if payload.art_style_ref is not None:
        session.current_step = CreationStep.STORYBOARD
    if payload.voice_ref is not None:
        session.current_step = CreationStep.PREVIEW
        session.status = CreationSessionStatus.PREVIEW
    await db.commit()
    return await get_session(db, user_id, session_id)


async def generate_story(
    db: AsyncSession,
    user_id: int,
    session_id: int,
    payload: IdeaStoryGenerateRequest,
) -> CreationTaskResponse:
    session = await _get_session_model(db, user_id, session_id)
    session.idea_prompt = payload.idea_prompt
    task = await generation_task.create_task(
        db,
        GenerationTaskCreate(
            task_type=GenerationTaskType.STORY,
            owner_type="creation",
            owner_id=session.id,
            user_id=user_id,
            input_payload={"idea_prompt": payload.idea_prompt},
        ),
    )
    await generation_task.mark_task_running(db, task.id)
    try:
        generated_text = await ai_provider.generate_text(db, task_id=task.id, prompt=payload.idea_prompt)
    except Exception as exc:
        failed = await _mark_generation_failed(db, session, task.id, exc)
        await db.commit()
        return CreationTaskResponse(session=await get_session(db, user_id, session_id), task=failed)
    session.status = CreationSessionStatus.DRAFT
    session.current_step = CreationStep.CHARACTER
    completed = await generation_task.mark_task_succeeded(db, task.id, result_refs={"story_preview": generated_text})
    await db.commit()
    return CreationTaskResponse(session=await get_session(db, user_id, session_id), task=completed)


async def generate_storyboard(db: AsyncSession, user_id: int, session_id: int) -> CreationTaskResponse:
    session = await _get_session_model(db, user_id, session_id)
    task = await generation_task.create_task(
        db,
        GenerationTaskCreate(
            task_type=GenerationTaskType.STORYBOARD,
            owner_type="creation",
            owner_id=session.id,
            user_id=user_id,
            input_payload={"target_page_count": session.target_page_count, "story_id": session.story_id},
        ),
    )
    await generation_task.mark_task_running(db, task.id)
    try:
        title = "专属绘本"
        if session.story_id is not None:
            story = await story_service.assert_story_usable(db, user_id, session.story_id)
            title = story.title
        structured = await ai_provider.generate_structured(
            db,
            task_id=task.id,
            request={"title": title, "target_page_count": session.target_page_count},
        )
    except Exception as exc:
        failed = await _mark_generation_failed(db, session, task.id, exc)
        await db.commit()
        return CreationTaskResponse(session=await get_session(db, user_id, session_id), task=failed)
    await _replace_storyboard_pages(db, session, structured["pages"])
    session.status = CreationSessionStatus.PREVIEW
    session.current_step = CreationStep.STORYBOARD
    completed = await generation_task.mark_task_succeeded(db, task.id, result_refs={"storyboard_page_count": len(structured["pages"])})
    await db.commit()
    return CreationTaskResponse(session=await get_session(db, user_id, session_id), task=completed)


async def update_storyboard_page(
    db: AsyncSession,
    user_id: int,
    session_id: int,
    page_id: int,
    payload: StoryboardPagePatch,
) -> CreationSessionRead:
    session = await _get_session_model(db, user_id, session_id)
    page = next((item for item in session.storyboard_pages if item.id == page_id), None)
    if page is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="分镜页不存在")
    data = payload.model_dump(mode="json")
    for field, value in data.items():
        setattr(page, field, value)
    page.image_asset_id = None
    page.audio_asset_id = None
    page.generation_status = StoryboardGenerationStatus.DRAFT
    await db.commit()
    return await get_session(db, user_id, session_id)


async def generate_images(
    db: AsyncSession,
    user_id: int,
    session_id: int,
    payload: GeneratePagesRequest,
) -> CreationTaskResponse:
    return await _generate_media_task(db, user_id, session_id, payload, GenerationTaskType.IMAGE)


async def generate_audio(
    db: AsyncSession,
    user_id: int,
    session_id: int,
    payload: GeneratePagesRequest,
) -> CreationTaskResponse:
    return await _generate_media_task(db, user_id, session_id, payload, GenerationTaskType.AUDIO)


async def regenerate(db: AsyncSession, user_id: int, session_id: int, payload: RegenerateRequest) -> CreationTaskResponse:
    session = await _get_session_model(db, user_id, session_id)
    task_type = TASK_TYPE_BY_REGENERATE_TARGET[payload.target_type]
    if task_type not in {GenerationTaskType.IMAGE, GenerationTaskType.AUDIO}:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="该重生成类型尚未实现")
    task = await generation_task.create_task(
        db,
        GenerationTaskCreate(
            task_type=task_type,
            owner_type="creation",
            owner_id=session.id,
            user_id=user_id,
            input_payload=payload.model_dump(mode="json"),
        ),
    )
    await generation_task.mark_task_running(db, task.id)
    for page in session.storyboard_pages:
        if payload.page_ids is None or page.id in payload.page_ids:
            page.generation_status = StoryboardGenerationStatus.PENDING
    try:
        if task_type == GenerationTaskType.IMAGE:
            await ai_provider.generate_image(db, task_id=task.id, page_ids=payload.page_ids)
        else:
            await ai_provider.generate_audio(db, task_id=task.id, page_ids=payload.page_ids)
    except Exception as exc:
        failed = await _mark_generation_failed(db, session, task.id, exc)
        for page in session.storyboard_pages:
            if payload.page_ids is None or page.id in payload.page_ids:
                page.generation_status = StoryboardGenerationStatus.FAILED
        await db.commit()
        return CreationTaskResponse(session=await get_session(db, user_id, session_id), task=failed)
    completed = await generation_task.mark_task_succeeded(
        db,
        task.id,
        result_refs={"target_type": payload.target_type, "page_ids": payload.page_ids or []},
    )
    await db.commit()
    return CreationTaskResponse(session=await get_session(db, user_id, session_id), task=completed)


async def save_book(db: AsyncSession, user_id: int, session_id: int) -> SaveBookResponse:
    session = await _get_session_model(db, user_id, session_id)
    if session.status != CreationSessionStatus.PREVIEW:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请先完成生成预览后再保存")
    if session.creation_type == CreationType.TEMPLATE_BOOK:
        if session.template_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="template_book 必须提供 template_id")
        book = await template_service.create_personal_book_from_template(
            db,
            user_id=user_id,
            template_id=session.template_id,
            voice_ref=session.voice_ref,
        )
        session.saved_book_id = book.id
        session.status = CreationSessionStatus.SAVED
        session.current_step = CreationStep.PREVIEW
        await db.commit()
        return SaveBookResponse(session=await get_session(db, user_id, session_id), book=await book_service.get_book_detail(db, book.id, user_id))
    if not session.storyboard_pages and session.creation_type != CreationType.TEMPLATE_BOOK:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请先生成分镜")
    title = "我的专属绘本"
    if session.story_id is not None:
        story = await story_service.assert_story_usable(db, user_id, session.story_id)
        title = story.title
    book = Book(
        owner_user_id=user_id,
        source_type=BookSourceType.TEMPLATE_RESULT if session.creation_type == CreationType.TEMPLATE_BOOK else BookSourceType.GENERATED,
        source_story_id=session.story_id,
        title=title,
        summary="由创作向导保存的个人绘本。",
        age_range_codes=session.age_range_codes or [],
        theme_codes=session.theme_codes or [],
        education_goal_codes=session.education_goal_codes or [],
        language=BookLanguage(session.language.value),
        narrative_style_code=session.narrative_style_code,
        art_style_code=(session.art_style_ref or {}).get("art_style_code") if session.art_style_ref else None,
        custom_art_style_prompt=(session.art_style_ref or {}).get("custom_prompt") if session.art_style_ref else None,
        default_voice_id=(session.voice_ref or {}).get("voice_id") if session.voice_ref else None,
        default_voice_name=(session.voice_ref or {}).get("display_name") if session.voice_ref else None,
        page_count=max(len(session.storyboard_pages), session.target_page_count),
        publish_status=BookPublishStatus.PUBLISHED,
        moderation_status=BookModerationStatus.PENDING,
    )
    db.add(book)
    await db.flush()
    for page in session.storyboard_pages:
        db.add(
            BookPage(
                book_id=book.id,
                page_no=page.page_no,
                title=page.title,
                text_zh=page.text_zh,
                text_en=page.text_en,
                narration_text=page.narration_text,
                visual_prompt=page.visual_prompt,
                image_asset_id=page.image_asset_id,
                audio_asset_id=page.audio_asset_id,
                lip_sync_status="none",
            )
        )
    session.saved_book_id = book.id
    session.status = CreationSessionStatus.SAVED
    session.current_step = CreationStep.PREVIEW
    await db.commit()
    return SaveBookResponse(session=await get_session(db, user_id, session_id), book=await book_service.get_book_detail(db, book.id, user_id))


async def _generate_media_task(
    db: AsyncSession,
    user_id: int,
    session_id: int,
    payload: GeneratePagesRequest,
    task_type: GenerationTaskType,
) -> CreationTaskResponse:
    session = await _get_session_model(db, user_id, session_id)
    task = await generation_task.create_task(
        db,
        GenerationTaskCreate(
            task_type=task_type,
            owner_type="creation",
            owner_id=session.id,
            user_id=user_id,
            input_payload={"page_ids": payload.page_ids or []},
        ),
    )
    await generation_task.mark_task_running(db, task.id)
    try:
        if task_type == GenerationTaskType.IMAGE:
            await ai_provider.generate_image(db, task_id=task.id, page_ids=payload.page_ids)
        else:
            await ai_provider.generate_audio(db, task_id=task.id, page_ids=payload.page_ids)
    except Exception as exc:
        failed = await _mark_generation_failed(db, session, task.id, exc)
        for page in session.storyboard_pages:
            if payload.page_ids is None or page.id in payload.page_ids:
                page.generation_status = StoryboardGenerationStatus.FAILED
        await db.commit()
        return CreationTaskResponse(session=await get_session(db, user_id, session_id), task=failed)
    for page in session.storyboard_pages:
        if payload.page_ids is None or page.id in payload.page_ids:
            page.generation_status = StoryboardGenerationStatus.READY
    session.current_step = CreationStep.VOICE if task_type == GenerationTaskType.IMAGE else CreationStep.PREVIEW
    completed = await generation_task.mark_task_succeeded(
        db,
        task.id,
        result_refs={"page_ids": payload.page_ids or [page.id for page in session.storyboard_pages]},
    )
    await db.commit()
    return CreationTaskResponse(session=await get_session(db, user_id, session_id), task=completed)


async def _replace_storyboard_pages(db: AsyncSession, session: CreationSession, pages: list[dict]) -> None:
    for page in list(session.storyboard_pages):
        await db.delete(page)
    await db.flush()
    for item in pages:
        db.add(
            CreationStoryboardPage(
                session_id=session.id,
                page_no=item["page_no"],
                title=item.get("title"),
                text_zh=item.get("text_zh"),
                text_en=item.get("text_en"),
                narration_text=item.get("narration_text"),
                visual_prompt=item.get("visual_prompt") or "儿童绘本插图",
                character_appearances=item.get("character_appearances") or [],
                dialogues=item.get("dialogues") or [],
                generation_status=StoryboardGenerationStatus.READY,
            )
        )


async def _mark_generation_failed(
    db: AsyncSession,
    session: CreationSession,
    task_id: int,
    exc: Exception,
) -> GenerationTaskRead:
    session.status = CreationSessionStatus.FAILED
    message = str(exc) or exc.__class__.__name__
    return await generation_task.mark_task_failed(
        db,
        task_id,
        error_code="PROVIDER_FAILED",
        error_message=message[:500],
    )


async def _get_session_model(db: AsyncSession, user_id: int, session_id: int) -> CreationSession:
    result = await db.execute(
        select(CreationSession)
        .options(selectinload(CreationSession.storyboard_pages))
        .execution_options(populate_existing=True)
        .where(CreationSession.id == session_id, CreationSession.user_id == user_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="创作会话不存在")
    return session
