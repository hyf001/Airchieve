from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.model.book import Book, BookLanguage, BookModerationStatus, BookPage, BookPublishStatus, BookSourceType
from app.model.asset import AssetKind
from app.model.creation import (
    CreationSession,
    CreationSessionStatus,
    CreationStep,
    CreationStoryboardPage,
    CreationType,
    StoryboardGenerationStatus,
)
from app.model.generation_task import GenerationTaskType
from app.model.generation_task import GenerationTask
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
from app.service import storage as storage_service
from app.service import template as template_service
from app.service.asset.voice import _get_voice_model


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


async def list_sessions(
    db: AsyncSession,
    user_id: int,
    *,
    child_profile_id: int | None = None,
    limit: int = 20,
    offset: int = 0,
) -> list[CreationSessionRead]:
    conditions = [CreationSession.user_id == user_id]
    if child_profile_id is not None:
        await account_service.assert_profile_belongs_to_user(db, child_profile_id, user_id)
        conditions.append(CreationSession.child_profile_id == child_profile_id)
    result = await db.execute(
        select(CreationSession)
        .options(selectinload(CreationSession.storyboard_pages))
        .where(*conditions)
        .order_by(CreationSession.updated_at.desc(), CreationSession.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return [_session_read(session) for session in result.scalars().unique().all()]


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
    if payload.voice_ref is not None:
        data["voice_ref"] = await _voice_ref_with_provider_voice_id(db, user_id, data["voice_ref"])
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
    await db.commit()
    return CreationTaskResponse(session=await get_session(db, user_id, session_id), task=task)


async def _voice_ref_with_provider_voice_id(db: AsyncSession, user_id: int, voice_ref: dict) -> dict:
    if voice_ref.get("source") == "template_default" or voice_ref.get("voice_id") is None:
        return voice_ref
    voice = await _get_voice_model(db, int(voice_ref["voice_id"]), user_id=user_id)
    if voice.owner_user_id is None and not voice.voice_style_code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="系统声音缺少 voice_style_code")
    enriched = dict(voice_ref)
    enriched["display_name"] = str(enriched.get("display_name") or "").strip() or voice.name
    enriched["provider_voice_id"] = voice.voice_style_code
    enriched["emotion_type"] = voice.emotion_type
    return enriched


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
    await db.commit()
    return CreationTaskResponse(session=await get_session(db, user_id, session_id), task=task)


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
    page.lip_sync_url = None
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


async def generate_lip_sync(
    db: AsyncSession,
    user_id: int,
    session_id: int,
    payload: GeneratePagesRequest,
) -> CreationTaskResponse:
    return await _generate_media_task(db, user_id, session_id, payload, GenerationTaskType.LIP_SYNC)


async def regenerate(db: AsyncSession, user_id: int, session_id: int, payload: RegenerateRequest) -> CreationTaskResponse:
    session = await _get_session_model(db, user_id, session_id)
    task_type = TASK_TYPE_BY_REGENERATE_TARGET[payload.target_type]
    if task_type not in {GenerationTaskType.IMAGE, GenerationTaskType.AUDIO, GenerationTaskType.LIP_SYNC}:
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
    for page in session.storyboard_pages:
        if payload.page_ids is None or page.id in payload.page_ids:
            page.generation_status = StoryboardGenerationStatus.PENDING
    await db.commit()
    return CreationTaskResponse(session=await get_session(db, user_id, session_id), task=task)


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
                image_url=page.image_url,
                video_url=page.lip_sync_url,
                audio_asset_id=page.audio_asset_id,
                audio_url=page.audio_url,
                lip_sync_status="ready" if page.lip_sync_url else "none",
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
    for page in session.storyboard_pages:
        if payload.page_ids is None or page.id in payload.page_ids:
            page.generation_status = StoryboardGenerationStatus.PENDING
    await db.commit()
    return CreationTaskResponse(session=await get_session(db, user_id, session_id), task=task)


async def run_story_task(db: AsyncSession, task: GenerationTask) -> None:
    session = await _get_task_session_model(db, task)
    prompt = str((task.input_payload or {}).get("idea_prompt") or session.idea_prompt or "").strip()
    if not prompt:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="STORY_PROMPT_MISSING")
    generated_text = await ai_provider.generate_text(db, task_id=task.id, prompt=prompt)
    session.idea_prompt = prompt
    session.status = CreationSessionStatus.DRAFT
    session.current_step = CreationStep.CHARACTER
    await generation_task.mark_task_succeeded(db, task.id, result_refs={"story_preview": generated_text})


async def run_storyboard_task(db: AsyncSession, task: GenerationTask) -> None:
    session = await _get_task_session_model(db, task)
    title = "专属绘本"
    story_content = title
    if session.story_id is not None:
        story = await story_service.assert_story_usable(db, session.user_id, session.story_id)
        title = story.title
        story_content = story.body
    structured = await ai_provider.generate_structured(
        db,
        task_id=task.id,
        request={"title": title, "story_content": story_content, "target_page_count": session.target_page_count},
    )
    await _replace_storyboard_pages(db, session, structured["pages"])
    session.status = CreationSessionStatus.PREVIEW
    session.current_step = CreationStep.STORYBOARD
    await generation_task.mark_task_succeeded(db, task.id, result_refs={"storyboard_page_count": len(structured["pages"])})


async def run_creation_image_task(db: AsyncSession, task: GenerationTask) -> None:
    session = await _get_task_session_model(db, task)
    page_ids = _task_page_ids(task)
    try:
        image_result = await ai_provider.generate_image(db, task_id=task.id, pages=_page_payloads(session, page_ids))
        await _persist_media_result_urls(db, session.user_id, image_result, url_key="image_url", asset_kind=AssetKind.IMAGE, extension=".png")
        _apply_image_results(session, image_result)
        for page in session.storyboard_pages:
            if page_ids is None or page.id in page_ids:
                page.generation_status = StoryboardGenerationStatus.READY
        session.current_step = CreationStep.VOICE
        await generation_task.mark_task_succeeded(db, task.id, result_refs={"page_ids": page_ids or [page.id for page in session.storyboard_pages]})
    except Exception:
        _mark_target_pages_failed(session, page_ids)
        raise


async def run_creation_audio_task(db: AsyncSession, task: GenerationTask) -> None:
    session = await _get_task_session_model(db, task)
    page_ids = _task_page_ids(task)
    try:
        audio_result = await ai_provider.generate_audio(
            db,
            task_id=task.id,
            pages=_page_payloads(session, page_ids),
            voice_ref=session.voice_ref,
        )
        await _persist_media_result_urls(db, session.user_id, audio_result, url_key="audio_url", asset_kind=AssetKind.AUDIO, extension=".wav")
        _apply_audio_results(session, audio_result)
        for page in session.storyboard_pages:
            if page_ids is None or page.id in page_ids:
                page.generation_status = StoryboardGenerationStatus.READY
        session.current_step = CreationStep.PREVIEW
        await generation_task.mark_task_succeeded(db, task.id, result_refs={"page_ids": page_ids or [page.id for page in session.storyboard_pages]})
    except Exception:
        _mark_target_pages_failed(session, page_ids)
        raise


async def run_creation_lip_sync_task(db: AsyncSession, task: GenerationTask) -> None:
    session = await _get_task_session_model(db, task)
    page_ids = _task_page_ids(task)
    try:
        lip_sync_result = await ai_provider.generate_lip_sync(db, task_id=task.id, pages=_page_payloads(session, page_ids))
        _apply_lip_sync_results(session, lip_sync_result)
        for page in session.storyboard_pages:
            if page_ids is None or page.id in page_ids:
                page.generation_status = StoryboardGenerationStatus.READY
        session.current_step = CreationStep.PREVIEW
        await generation_task.mark_task_succeeded(db, task.id, result_refs={"page_ids": page_ids or [page.id for page in session.storyboard_pages]})
    except Exception:
        _mark_target_pages_failed(session, page_ids)
        raise


def _page_payloads(session: CreationSession, page_ids: list[int] | None) -> list[dict]:
    pages = [page for page in session.storyboard_pages if page_ids is None or page.id in page_ids]
    if not pages:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="没有可生成的分镜页")
    return [
        {
            "id": page.id,
            "page_no": page.page_no,
            "title": page.title,
            "text_zh": page.text_zh,
            "text_en": page.text_en,
            "narration_text": page.narration_text,
            "visual_prompt": page.visual_prompt,
            "character_appearances": page.character_appearances or [],
            "dialogues": page.dialogues or [],
            "image_url": page.image_url,
            "audio_url": page.audio_url,
            "lip_sync_url": page.lip_sync_url,
        }
        for page in pages
    ]


def _apply_image_results(session: CreationSession, image_result: dict) -> None:
    images_by_page_id = {
        item.get("page_id"): item
        for item in image_result.get("page_results", [])
        if item.get("page_id") is not None and item.get("image_url")
    }
    for page in session.storyboard_pages:
        image_item = images_by_page_id.get(page.id)
        if image_item:
            page.image_url = image_item.get("image_url")
            page.image_asset_id = image_item.get("image_asset_id") or page.image_asset_id


async def _persist_media_result_urls(
    db: AsyncSession,
    user_id: int,
    result: dict,
    *,
    url_key: str,
    asset_kind: AssetKind,
    extension: str,
) -> None:
    for item in result.get("page_results", []):
        url = str(item.get(url_key) or "")
        if not url.startswith("data:"):
            continue
        stored = await storage_service.save_generated_data_url(
            db,
            user_id,
            data_url=url,
            asset_kind=asset_kind,
            filename_extension=extension,
        )
        item[url_key] = stored.url
        asset_key = f"{asset_kind.value}_asset_id"
        item[asset_key] = stored.id


def _apply_audio_results(session: CreationSession, audio_result: dict) -> None:
    audio_by_page_id = {
        item.get("page_id"): item
        for item in audio_result.get("page_results", [])
        if item.get("page_id") is not None and item.get("audio_url")
    }
    for page in session.storyboard_pages:
        audio_item = audio_by_page_id.get(page.id)
        if audio_item:
            page.audio_url = audio_item.get("audio_url")
            page.audio_asset_id = audio_item.get("audio_asset_id") or page.audio_asset_id
            page.lip_sync_url = None


def _apply_lip_sync_results(session: CreationSession, lip_sync_result: dict) -> None:
    lip_sync_by_page_id = {
        item.get("page_id"): item.get("lip_sync_url")
        for item in lip_sync_result.get("page_results", [])
        if item.get("page_id") is not None and item.get("lip_sync_url")
    }
    for page in session.storyboard_pages:
        lip_sync_url = lip_sync_by_page_id.get(page.id)
        if lip_sync_url:
            page.lip_sync_url = lip_sync_url


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


async def mark_task_owner_failed(db: AsyncSession, task: GenerationTask, exc: BaseException) -> None:
    if task.owner_type != "creation" or task.user_id is None:
        return
    try:
        session = await _get_task_session_model(db, task)
    except HTTPException:
        return
    if task.task_type in {GenerationTaskType.IMAGE, GenerationTaskType.AUDIO, GenerationTaskType.LIP_SYNC}:
        _mark_target_pages_failed(session, _task_page_ids(task))
    else:
        session.status = CreationSessionStatus.FAILED
    _ = exc


async def _get_task_session_model(db: AsyncSession, task: GenerationTask) -> CreationSession:
    if task.owner_type != "creation" or task.user_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CREATION_TASK_OWNER_INVALID")
    return await _get_session_model(db, task.user_id, task.owner_id)


def _task_page_ids(task: GenerationTask) -> list[int] | None:
    page_ids = (task.input_payload or {}).get("page_ids")
    if page_ids is None:
        return None
    if not page_ids:
        return None
    return [int(page_id) for page_id in page_ids]


def _mark_target_pages_failed(session: CreationSession, page_ids: list[int] | None) -> None:
    for page in session.storyboard_pages:
        if page_ids is None or page.id in page_ids:
            page.generation_status = StoryboardGenerationStatus.FAILED


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
