from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.model.book import (
    Book,
    BookLipSyncStatus,
    BookLanguage,
    BookModerationStatus,
    BookPage,
    BookPlaybackMediaMode,
    BookPlaybackSegment,
    BookPlaybackSegmentType,
    BookPublishStatus,
    BookSegmentFallbackMode,
    BookSourceType,
    BookSubtitleCue,
    BookSubtitleCueType,
    BookSubtitlePosition,
)
from app.model.asset import ArtStyle, ArtStyleStatus, AssetKind, LibraryItemStatus
from app.model.asset.character import Character
from app.model.creation import (
    CreationSession,
    CreationSessionStatus,
    CreationStep,
    CreationPageDraft,
    CreationType,
    PageDraftTaskStatus,
)
from app.model.generation_task import GenerationTaskType
from app.model.generation_task import GenerationTask
from app.schema.creation import (
    CreationConfigPatch,
    CreationSessionCreate,
    CreationSessionRead,
    CreationTaskResponse,
    GenerateImagesRequest,
    GeneratePageImageRequest,
    GeneratePagesRequest,
    IdeaStoryGenerateRequest,
    PageDraftPatch,
    RegenerateRequest,
    SaveBookResponse,
    TASK_TYPE_BY_REGENERATE_TARGET,
)
from app.schema.ai_provider import (
    ImageAspectRatio,
    PageCharacterImageRef,
    PageMediaInput,
    PictureBookAudioResult,
    PictureBookImageResult,
    PictureBookLipSyncResult,
    PictureBookStoryboardRequest,
    StoryPromptCharacter,
    StoryboardCharacterAppearance,
    StoryboardPlaybackSegmentType,
    StoryboardPage,
    VoicePromptRef,
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
        .options(selectinload(CreationSession.page_drafts))
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
    if payload.character_refs is not None:
        data["character_refs"] = await _character_refs_with_image_urls(db, user_id, data["character_refs"])
    if payload.art_style_ref is not None:
        data["art_style_ref"] = await _art_style_ref_with_prompt(db, user_id, data["art_style_ref"])
    for field, value in data.items():
        setattr(session, field, value)
    if payload.character_refs is not None:
        session.current_step = CreationStep.STORYBOARD if session.creation_type != CreationType.TEMPLATE_BOOK else CreationStep.VOICE
    if payload.art_style_ref is not None:
        session.current_step = CreationStep.CHARACTER
    if payload.voice_ref is not None:
        session.current_step = CreationStep.VOICE
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
    enriched = dict(voice_ref)
    role_voice_refs = enriched.get("role_voice_refs")
    if isinstance(role_voice_refs, list):
        enriched["role_voice_refs"] = [
            await _voice_ref_with_provider_voice_id(db, user_id, role_voice_ref)
            for role_voice_ref in role_voice_refs
            if isinstance(role_voice_ref, dict)
        ]
    if enriched.get("source") == "template_default" or enriched.get("voice_id") is None:
        return enriched
    voice = await _get_voice_model(db, int(enriched["voice_id"]), user_id=user_id)
    if voice.owner_user_id is None and not voice.voice_style_code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="系统声音缺少 voice_style_code")
    enriched["display_name"] = str(enriched.get("display_name") or "").strip() or voice.name
    enriched["provider_voice_id"] = voice.voice_style_code
    enriched["emotion_type"] = voice.emotion_type
    return enriched


async def _character_refs_with_image_urls(db: AsyncSession, user_id: int, character_refs: list[dict]) -> list[dict]:
    enriched_refs: list[dict] = []
    for ref in character_refs:
        enriched = dict(ref)
        character_id = enriched.get("character_id")
        if character_id is not None:
            character = await db.get(Character, int(character_id))
            if (
                character is not None
                and character.status == LibraryItemStatus.ACTIVE
                and (character.owner_user_id is None or character.owner_user_id == user_id)
            ):
                enriched["image_url"] = character.image_url
                enriched["display_name"] = str(enriched.get("display_name") or "").strip() or character.name
            else:
                enriched["character_id"] = None
                enriched.pop("image_url", None)
        enriched_refs.append(enriched)
    return enriched_refs


async def _art_style_ref_with_prompt(db: AsyncSession, user_id: int, art_style_ref: dict) -> dict:
    enriched = dict(art_style_ref)
    style_prompt = str(enriched.get("custom_prompt") or "").strip()
    art_style_id = enriched.get("art_style_id")
    if art_style_id is not None:
        style = await db.get(ArtStyle, int(art_style_id))
        if (
            style is not None
            and style.status == ArtStyleStatus.ACTIVE
            and (style.owner_user_id is None or style.owner_user_id == user_id)
        ):
            style_prompt = style_prompt or style.prompt or style.description or style.name
            enriched["art_style_code"] = enriched.get("art_style_code") or style.code
    if style_prompt:
        enriched["style_prompt"] = style_prompt
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


async def update_page_draft(
    db: AsyncSession,
    user_id: int,
    session_id: int,
    page_id: int,
    payload: PageDraftPatch,
) -> CreationSessionRead:
    session = await _get_session_model(db, user_id, session_id)
    page = next((item for item in session.page_drafts if item.id == page_id), None)
    if page is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="分镜页不存在")
    data = payload.model_dump(mode="json")
    if "voice_config" in data and data["voice_config"]:
        data["voice_config"] = await _voice_ref_with_provider_voice_id(db, user_id, data["voice_config"])
    for field, value in data.items():
        setattr(page, field, value)
    page.image_asset_id = None
    page.image_url = None
    page.audio_asset_id = None
    page.audio_url = None
    page.lip_sync_url = None
    page.storyboard_status = PageDraftTaskStatus.DRAFT
    page.image_status = PageDraftTaskStatus.DRAFT
    page.audio_status = PageDraftTaskStatus.DRAFT
    page.lip_sync_status = PageDraftTaskStatus.DRAFT
    await db.commit()
    return await get_session(db, user_id, session_id)


async def generate_images(
    db: AsyncSession,
    user_id: int,
    session_id: int,
    payload: GenerateImagesRequest,
) -> CreationTaskResponse:
    session = await _get_session_model(db, user_id, session_id)
    task = await generation_task.create_task(
        db,
        GenerationTaskCreate(
            task_type=GenerationTaskType.IMAGE,
            owner_type="creation",
            owner_id=session.id,
            user_id=user_id,
            input_payload=payload.model_dump(mode="json"),
        ),
    )
    for page in session.page_drafts:
        page.image_status = PageDraftTaskStatus.PENDING
    await db.commit()
    return CreationTaskResponse(session=await get_session(db, user_id, session_id), task=task)


async def generate_page_image(
    db: AsyncSession,
    user_id: int,
    session_id: int,
    page_id: int,
    payload: GeneratePageImageRequest,
) -> CreationTaskResponse:
    session = await _get_session_model(db, user_id, session_id)
    page = next((item for item in session.page_drafts if item.id == page_id), None)
    if page is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="分镜页不存在")
    task = await generation_task.create_task(
        db,
        GenerationTaskCreate(
            task_type=GenerationTaskType.PAGE_IMAGE,
            owner_type="creation",
            owner_id=session.id,
            user_id=user_id,
            input_payload={
                "page_id": page_id,
                **payload.model_dump(mode="json", exclude_none=True),
            },
        ),
    )
    page.image_status = PageDraftTaskStatus.PENDING
    await db.commit()
    return CreationTaskResponse(session=await get_session(db, user_id, session_id), task=task)


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
    if task_type not in {GenerationTaskType.PAGE_IMAGE, GenerationTaskType.AUDIO, GenerationTaskType.LIP_SYNC}:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="该重生成类型尚未实现")
    if task_type == GenerationTaskType.PAGE_IMAGE and len(payload.page_ids or []) != 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="单页图片重生成必须指定一个 page_id")
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
    status_field = _status_field_for_task(task_type)
    for page in session.page_drafts:
        if payload.page_ids is None or page.id in payload.page_ids:
            setattr(page, status_field, PageDraftTaskStatus.PENDING)
    await db.commit()
    return CreationTaskResponse(session=await get_session(db, user_id, session_id), task=task)


async def save_book(db: AsyncSession, user_id: int, session_id: int) -> SaveBookResponse:
    session = await _get_session_model(db, user_id, session_id)
    if session.status not in {CreationSessionStatus.PREVIEW, CreationSessionStatus.DRAFT}:
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
    if not session.page_drafts and session.creation_type != CreationType.TEMPLATE_BOOK:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请先生成分镜")
    _assert_story_book_ready_to_save(session)
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
        background_music_id=None,
        age_range_codes=session.age_range_codes or [],
        theme_codes=session.theme_codes or [],
        education_goal_codes=session.education_goal_codes or [],
        language=BookLanguage(session.language.value),
        narrative_style_code=session.narrative_style_code,
        art_style_code=(session.art_style_ref or {}).get("art_style_code") if session.art_style_ref else None,
        default_voice_id=(session.voice_ref or {}).get("voice_id") if session.voice_ref else None,
        page_count=max(len(session.page_drafts), session.target_page_count),
        publish_status=BookPublishStatus.PUBLISHED,
        moderation_status=BookModerationStatus.PENDING,
    )
    db.add(book)
    await db.flush()
    for page_draft in session.page_drafts:
        page = BookPage(
            book_id=book.id,
            page_no=page_draft.page_no,
            title=page_draft.title,
            text_zh=page_draft.text_zh,
            text_en=page_draft.text_en,
            narration_text=page_draft.narration_text,
            visual_prompt=page_draft.visual_prompt,
            image_url=page_draft.image_url,
            audio_url=page_draft.audio_url,
        )
        db.add(page)
        await db.flush()
        await _create_default_playback_segments(db, page, page_draft)
    session.saved_book_id = book.id
    session.status = CreationSessionStatus.SAVED
    session.current_step = CreationStep.PREVIEW
    await db.commit()
    return SaveBookResponse(session=await get_session(db, user_id, session_id), book=await book_service.get_book_detail(db, book.id, user_id))


def _assert_story_book_ready_to_save(session: CreationSession) -> None:
    if not session.page_drafts:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请先生成分镜")
    pending_pages = [
        page.page_no
        for page in session.page_drafts
        if page.image_status != PageDraftTaskStatus.READY
        or page.audio_status != PageDraftTaskStatus.READY
        or not page.image_url
        or not _page_has_required_audio(page)
    ]
    if pending_pages:
        page_text = "、".join(str(page_no) for page_no in pending_pages[:5])
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"请先完成第 {page_text} 页的插图和语音生成")


async def _create_default_playback_segments(db: AsyncSession, page: BookPage, page_draft: CreationPageDraft) -> None:
    if page_draft.playback_segments:
        await _create_scripted_playback_segments(db, page, page_draft)
        return
    narration_text = page_draft.narration_text or page_draft.text_zh or page_draft.text_en
    subtitle_config = page_draft.subtitle_config or {}
    subtitle_position = _subtitle_position(str(subtitle_config.get("position") or "bottom"))
    subtitle_position_config = subtitle_config.get("position_config") if isinstance(subtitle_config.get("position_config"), dict) else None
    if narration_text or page_draft.audio_url:
        has_lip_sync = bool(page_draft.lip_sync_url)
        segment = BookPlaybackSegment(
            page_id=page.id,
            segment_type=BookPlaybackSegmentType.NARRATION,
            speaker_ref=None,
            image_url=page_draft.image_url,
            audio_url=page_draft.audio_url,
            lip_sync_url=page_draft.lip_sync_url,
            media_mode=BookPlaybackMediaMode.LIP_SYNC if has_lip_sync else BookPlaybackMediaMode.AUDIO,
            fallback_mode=BookSegmentFallbackMode.PAGE_IMAGE_AUDIO,
            lip_sync_status=BookLipSyncStatus.READY if has_lip_sync else BookLipSyncStatus.NONE,
            sort_order=0,
        )
        db.add(segment)
        await db.flush()
        db.add(
            BookSubtitleCue(
                segment_id=segment.id,
                cue_type=BookSubtitleCueType.NARRATION,
                speaker_ref=None,
                start_ms=0,
                text_zh=narration_text,
                text_en=page_draft.text_en,
                position=subtitle_position,
                position_config=subtitle_position_config,
                sort_order=0,
            )
        )
    await _create_legacy_dialogue_segments(db, page, page_draft, subtitle_position, subtitle_position_config)


async def _create_scripted_playback_segments(db: AsyncSession, page: BookPage, page_draft: CreationPageDraft) -> None:
    subtitle_config = page_draft.subtitle_config or {}
    subtitle_position = _subtitle_position(str(subtitle_config.get("position") or "bottom"))
    subtitle_position_config = subtitle_config.get("position_config") if isinstance(subtitle_config.get("position_config"), dict) else None
    for index, raw_segment in enumerate(_ordered_raw_playback_segments(page_draft.playback_segments), start=1):
        segment_type = str(raw_segment.get("segment_type") or raw_segment.get("type") or "").strip()
        text = str(raw_segment.get("text") or "").strip()
        if segment_type not in {BookPlaybackSegmentType.NARRATION.value, BookPlaybackSegmentType.DIALOGUE.value} or not text:
            continue
        is_dialogue = segment_type == BookPlaybackSegmentType.DIALOGUE.value
        speaker_ref = raw_segment.get("speaker_ref") if is_dialogue else None
        audio_url = raw_segment.get("audio_url")
        lip_sync_url = raw_segment.get("lip_sync_url") if is_dialogue else None
        has_lip_sync = bool(lip_sync_url)
        playback_segment = BookPlaybackSegment(
            page_id=page.id,
            segment_type=BookPlaybackSegmentType.DIALOGUE if is_dialogue else BookPlaybackSegmentType.NARRATION,
            speaker_ref=speaker_ref,
            image_url=page_draft.image_url,
            audio_url=audio_url,
            lip_sync_url=lip_sync_url,
            media_mode=BookPlaybackMediaMode.LIP_SYNC if has_lip_sync else BookPlaybackMediaMode.AUDIO,
            start_ms=raw_segment.get("start_ms"),
            end_ms=raw_segment.get("end_ms"),
            fallback_mode=BookSegmentFallbackMode.PAGE_IMAGE_DIALOGUE_AUDIO if is_dialogue else BookSegmentFallbackMode.PAGE_IMAGE_AUDIO,
            lip_sync_status=BookLipSyncStatus.READY if has_lip_sync else BookLipSyncStatus.NONE,
            sort_order=int(raw_segment.get("sort_order") if raw_segment.get("sort_order") is not None else index - 1),
        )
        db.add(playback_segment)
        await db.flush()
        db.add(
            BookSubtitleCue(
                segment_id=playback_segment.id,
                cue_type=BookSubtitleCueType.DIALOGUE if is_dialogue else BookSubtitleCueType.NARRATION,
                speaker_ref=speaker_ref,
                start_ms=0,
                end_ms=(
                    raw_segment.get("end_ms") - raw_segment.get("start_ms")
                    if raw_segment.get("start_ms") is not None and raw_segment.get("end_ms") is not None
                    else None
                ),
                text_zh=text,
                text_en=raw_segment.get("text_en"),
                position=subtitle_position,
                position_config=subtitle_position_config,
                sort_order=0,
            )
        )


async def _create_legacy_dialogue_segments(
    db: AsyncSession,
    page: BookPage,
    page_draft: CreationPageDraft,
    subtitle_position: BookSubtitlePosition,
    subtitle_position_config: dict | None,
) -> None:
    for index, dialogue in enumerate(page_draft.dialogues or [], start=1):
        speaker_ref = dialogue.get("speaker_ref") or dialogue.get("character_ref")
        start_ms = dialogue.get("start_ms")
        end_ms = dialogue.get("end_ms")
        segment = BookPlaybackSegment(
            page_id=page.id,
            segment_type=BookPlaybackSegmentType.DIALOGUE,
            speaker_ref=speaker_ref,
            image_url=page_draft.image_url,
            audio_url=dialogue.get("audio_url"),
            lip_sync_url=dialogue.get("lip_sync_url") or page_draft.lip_sync_url,
            media_mode=BookPlaybackMediaMode.LIP_SYNC
            if dialogue.get("lip_sync_url") or page_draft.lip_sync_url
            else BookPlaybackMediaMode.AUDIO,
            start_ms=start_ms,
            end_ms=end_ms,
            fallback_mode=BookSegmentFallbackMode.PAGE_IMAGE_DIALOGUE_AUDIO,
            lip_sync_status=BookLipSyncStatus.READY
            if dialogue.get("lip_sync_url") or page_draft.lip_sync_url
            else BookLipSyncStatus.NONE,
            sort_order=index,
        )
        db.add(segment)
        await db.flush()
        db.add(
            BookSubtitleCue(
                segment_id=segment.id,
                cue_type=BookSubtitleCueType.DIALOGUE,
                speaker_ref=speaker_ref,
                start_ms=0,
                end_ms=end_ms - start_ms if start_ms is not None and end_ms is not None else None,
                text_zh=dialogue.get("text"),
                text_en=dialogue.get("text_en"),
                position=subtitle_position,
                position_config=subtitle_position_config,
                sort_order=0,
            )
        )


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
    status_field = _status_field_for_task(task_type)
    for page in session.page_drafts:
        if payload.page_ids is None or page.id in payload.page_ids:
            setattr(page, status_field, PageDraftTaskStatus.PENDING)
    await db.commit()
    return CreationTaskResponse(session=await get_session(db, user_id, session_id), task=task)


async def run_story_task(db: AsyncSession, task: GenerationTask) -> None:
    session = await _get_task_session_model(db, task)
    prompt = str((task.input_payload or {}).get("idea_prompt") or session.idea_prompt or "").strip()
    if not prompt:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="STORY_PROMPT_MISSING")
    generated_text = await ai_provider.draft_story_text_from_prompt(db, task_id=task.id, prompt=prompt)
    session.idea_prompt = prompt
    session.status = CreationSessionStatus.DRAFT
    session.current_step = CreationStep.CHARACTER
    await generation_task.mark_task_succeeded(db, task.id, result_refs={"story_preview": generated_text})


async def run_storyboard_task(db: AsyncSession, task: GenerationTask) -> None:
    session = await _get_task_session_model(db, task)
    title = "专属绘本"
    story_content = title
    story_characters: list[dict] = []
    if session.story_id is not None:
        story = await story_service.assert_story_usable(db, session.user_id, session.story_id)
        title = story.title
        story_content = story.body
        story_characters = [character.model_dump(mode="json") for character in story.characters]
    structured = await ai_provider.create_picture_book_storyboard(
        db,
        task_id=task.id,
        request=PictureBookStoryboardRequest(
            title=title,
            story_content=story_content,
            characters=[_story_prompt_character(character) for character in story_characters],
            character_refs=[_story_prompt_character(character) for character in session.character_refs or []],
            target_page_count=session.target_page_count,
        ),
    )
    await _replace_page_drafts(db, session, structured.pages)
    session.status = CreationSessionStatus.PREVIEW
    session.current_step = CreationStep.STORYBOARD
    await generation_task.mark_task_succeeded(db, task.id, result_refs={"page_draft_count": len(structured.pages)})


async def run_creation_image_task(db: AsyncSession, task: GenerationTask) -> None:
    session = await _get_task_session_model(db, task)
    aspect_ratio = _task_aspect_ratio(task)
    try:
        image_result = await ai_provider.create_picture_book_page_images(
            db,
            task_id=task.id,
            pages=_page_payloads(session, None),
            aspect_ratio=aspect_ratio,
        )
        await _persist_media_result_urls(db, session.user_id, image_result, url_key="image_url", asset_kind=AssetKind.IMAGE, extension=".png")
        _apply_image_results(session, image_result)
        for page in session.page_drafts:
            page.image_status = PageDraftTaskStatus.READY
        session.current_step = CreationStep.VOICE
        await generation_task.mark_task_succeeded(db, task.id, result_refs={"page_ids": [page.id for page in session.page_drafts]})
    except Exception:
        _mark_target_pages_failed(session, None, GenerationTaskType.IMAGE)
        raise


async def run_creation_page_image_task(db: AsyncSession, task: GenerationTask) -> None:
    session = await _get_task_session_model(db, task)
    page_id = _task_page_id(task)
    aspect_ratio = _task_aspect_ratio(task)
    try:
        image_result = await ai_provider.create_picture_book_single_page_image(
            db,
            task_id=task.id,
            page=_single_page_payload(session, page_id),
            aspect_ratio=aspect_ratio,
        )
        await _persist_media_result_urls(db, session.user_id, image_result, url_key="image_url", asset_kind=AssetKind.IMAGE, extension=".png")
        _apply_image_results(session, image_result)
        for page in session.page_drafts:
            if page.id == page_id:
                page.image_status = PageDraftTaskStatus.READY
        await generation_task.mark_task_succeeded(db, task.id, result_refs={"page_ids": [page_id]})
    except Exception:
        _mark_target_pages_failed(session, [page_id], GenerationTaskType.PAGE_IMAGE)
        raise


async def run_creation_audio_task(db: AsyncSession, task: GenerationTask) -> None:
    session = await _get_task_session_model(db, task)
    page_ids = _task_page_ids(task)
    try:
        audio_result = await ai_provider.create_picture_book_page_audio(
            db,
            task_id=task.id,
            pages=_page_payloads(session, page_ids),
        )
        await _persist_media_result_urls(db, session.user_id, audio_result, url_key="audio_url", asset_kind=AssetKind.AUDIO, extension=".wav")
        _apply_audio_results(session, audio_result)
        for page in session.page_drafts:
            if page_ids is None or page.id in page_ids:
                page.audio_status = PageDraftTaskStatus.READY
        session.current_step = CreationStep.LIP_SYNC
        await generation_task.mark_task_succeeded(db, task.id, result_refs={"page_ids": page_ids or [page.id for page in session.page_drafts]})
    except Exception:
        _mark_target_pages_failed(session, page_ids, GenerationTaskType.AUDIO)
        raise


async def run_creation_lip_sync_task(db: AsyncSession, task: GenerationTask) -> None:
    session = await _get_task_session_model(db, task)
    page_ids = _task_page_ids(task)
    try:
        lip_sync_result = await ai_provider.create_picture_book_page_lip_sync(db, task_id=task.id, pages=_page_payloads(session, page_ids))
        _apply_lip_sync_results(session, lip_sync_result)
        for page in session.page_drafts:
            if page_ids is None or page.id in page_ids:
                page.lip_sync_status = PageDraftTaskStatus.READY
        session.current_step = CreationStep.PREVIEW
        await generation_task.mark_task_succeeded(db, task.id, result_refs={"page_ids": page_ids or [page.id for page in session.page_drafts]})
    except Exception:
        _mark_target_pages_failed(session, page_ids, GenerationTaskType.LIP_SYNC)
        raise


def _page_payloads(session: CreationSession, page_ids: list[int] | None) -> list[PageMediaInput]:
    pages = [page for page in session.page_drafts if page_ids is None or page.id in page_ids]
    if not pages:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="没有可生成的分镜页")
    character_refs_by_role = _session_character_refs_by_role(session)
    all_character_refs = _all_character_image_refs(character_refs_by_role)
    include_continuity = page_ids is not None and len(pages) == 1
    return [
        PageMediaInput(
            id=page.id,
            page_no=page.page_no,
            title=page.title,
            text_zh=page.text_zh,
            text_en=page.text_en,
            narration_text=page.narration_text,
            visual_prompt=page.visual_prompt,
            art_style_prompt=_art_style_prompt_for_session(session),
            all_character_refs=all_character_refs,
            character_appearances=_page_character_image_refs(page.character_appearances or [], character_refs_by_role),
            continuity_image_urls=_previous_page_image_urls(session, page) if include_continuity else [],
            dialogues=page.dialogues or [],
            playback_segments=page.playback_segments or [],
            voice_config=VoicePromptRef.model_validate(page.voice_config or session.voice_ref) if page.voice_config or session.voice_ref else None,
            image_url=page.image_url,
            audio_url=page.audio_url,
            lip_sync_url=page.lip_sync_url,
        )
        for page in pages
    ]


def _single_page_payload(session: CreationSession, page_id: int) -> PageMediaInput:
    payloads = _page_payloads(session, [page_id])
    return payloads[0]


def _all_character_image_refs(character_refs_by_role: dict[str, dict]) -> list[PageCharacterImageRef]:
    return [
        PageCharacterImageRef(
            role_code=role_code,
            display_name=character_ref.get("display_name"),
            character_id=character_ref.get("character_id"),
            image_url=character_ref.get("image_url"),
        )
        for role_code, character_ref in character_refs_by_role.items()
        if character_ref.get("image_url")
    ]


def _previous_page_image_urls(session: CreationSession, page: CreationPageDraft) -> list[str]:
    ordered_pages = sorted(session.page_drafts, key=lambda item: (item.page_no or 0, item.id or 0))
    current_index = next((index for index, item in enumerate(ordered_pages) if item.id == page.id), None)
    if current_index is None:
        return []
    previous_pages = list(reversed(ordered_pages[max(0, current_index - 2):current_index]))
    return [
        image_url
        for image_url in (item.image_url for item in previous_pages)
        if isinstance(image_url, str) and image_url.startswith(("http://", "https://", "data:"))
    ]


def _apply_image_results(session: CreationSession, image_result: PictureBookImageResult) -> None:
    images_by_page_id = {
        item.page_id: item
        for item in image_result.page_results
        if item.image_url
    }
    for page in session.page_drafts:
        image_item = images_by_page_id.get(page.id)
        if image_item:
            page.image_url = image_item.image_url
            page.image_asset_id = image_item.image_asset_id or page.image_asset_id


async def _persist_media_result_urls(
    db: AsyncSession,
    user_id: int,
    result: PictureBookImageResult | PictureBookAudioResult,
    *,
    url_key: str,
    asset_kind: AssetKind,
    extension: str,
) -> None:
    for item in result.page_results:
        url = str(getattr(item, url_key) or "")
        if url.startswith("data:"):
            stored = await storage_service.save_generated_data_url(
                db,
                user_id,
                data_url=url,
                asset_kind=asset_kind,
                filename_extension=extension,
            )
            setattr(item, url_key, stored.url)
            asset_key = f"{asset_kind.value}_asset_id"
            setattr(item, asset_key, stored.id)
        for segment_item in getattr(item, "segment_results", []) or []:
            segment_url = str(getattr(segment_item, url_key) or "")
            if not segment_url.startswith("data:"):
                continue
            stored = await storage_service.save_generated_data_url(
                db,
                user_id,
                data_url=segment_url,
                asset_kind=asset_kind,
                filename_extension=extension,
            )
            setattr(segment_item, url_key, stored.url)
            asset_key = f"{asset_kind.value}_asset_id"
            setattr(segment_item, asset_key, stored.id)


def _apply_audio_results(session: CreationSession, audio_result: PictureBookAudioResult) -> None:
    audio_by_page_id = {
        item.page_id: item
        for item in audio_result.page_results
        if item.audio_url
    }
    for page in session.page_drafts:
        audio_item = audio_by_page_id.get(page.id)
        if audio_item:
            page.audio_url = audio_item.audio_url
            page.audio_asset_id = audio_item.audio_asset_id or page.audio_asset_id
            if audio_item.segment_results:
                _apply_segment_audio_results(page, audio_item.segment_results)
            page.lip_sync_url = None
            page.lip_sync_status = PageDraftTaskStatus.DRAFT


def _apply_lip_sync_results(session: CreationSession, lip_sync_result: PictureBookLipSyncResult) -> None:
    lip_sync_by_page_id = {
        item.page_id: item.lip_sync_url
        for item in lip_sync_result.page_results
        if item.lip_sync_url
    }
    for page in session.page_drafts:
        lip_sync_url = lip_sync_by_page_id.get(page.id)
        if lip_sync_url:
            page.lip_sync_url = lip_sync_url
        lip_sync_item = next((item for item in lip_sync_result.page_results if item.page_id == page.id), None)
        if lip_sync_item and lip_sync_item.segment_results:
            _apply_segment_lip_sync_results(page, lip_sync_item.segment_results)


def _page_has_required_audio(page: CreationPageDraft) -> bool:
    if page.playback_segments:
        return all(
            not _segment_text(segment) or bool(segment.get("audio_url"))
            for segment in page.playback_segments
        )
    return bool(page.audio_url)


def _apply_segment_audio_results(page: CreationPageDraft, segment_results: list[object]) -> None:
    segments = [dict(segment) for segment in page.playback_segments or []]
    results_by_order = {getattr(item, "sort_order"): item for item in segment_results}
    for segment in segments:
        result = results_by_order.get(segment.get("sort_order"))
        if result is None:
            continue
        segment["audio_url"] = getattr(result, "audio_url")
        audio_asset_id = getattr(result, "audio_asset_id", None)
        if audio_asset_id is not None:
            segment["audio_asset_id"] = audio_asset_id
        segment.pop("lip_sync_url", None)
    page.playback_segments = segments


def _apply_segment_lip_sync_results(page: CreationPageDraft, segment_results: list[object]) -> None:
    segments = [dict(segment) for segment in page.playback_segments or []]
    results_by_order = {getattr(item, "sort_order"): item for item in segment_results}
    for segment in segments:
        result = results_by_order.get(segment.get("sort_order"))
        if result is None:
            continue
        segment["lip_sync_url"] = getattr(result, "lip_sync_url")
    page.playback_segments = segments


def _ordered_raw_playback_segments(segments: list[dict]) -> list[dict]:
    return sorted(
        (segment for segment in segments if isinstance(segment, dict)),
        key=lambda segment: int(segment.get("sort_order") or 0),
    )


def _segment_text(segment: dict) -> str:
    return str(segment.get("text") or "").strip()


async def _replace_page_drafts(db: AsyncSession, session: CreationSession, pages: list[StoryboardPage]) -> None:
    character_refs_by_role = _session_character_refs_by_role(session)
    for page in list(session.page_drafts):
        await db.delete(page)
    await db.flush()
    for item in pages:
        db.add(
            CreationPageDraft(
                session_id=session.id,
                page_no=item.page_no,
                title=item.title,
                text_zh=item.text_zh,
                text_en=item.text_en,
                narration_text=item.narration_text,
                visual_prompt=item.visual_prompt or "儿童绘本插图",
                character_appearances=_storyboard_appearances_for_storage(
                    item.character_appearances,
                    character_refs_by_role,
                ),
                dialogues=[dialogue.model_dump(mode="json", exclude_none=True) for dialogue in item.dialogues],
                playback_segments=[segment.model_dump(mode="json", exclude_none=True) for segment in item.playback_segments],
                storyboard_status=PageDraftTaskStatus.READY,
                image_status=PageDraftTaskStatus.DRAFT,
                audio_status=PageDraftTaskStatus.DRAFT,
                lip_sync_status=PageDraftTaskStatus.DRAFT,
            )
        )


def _story_prompt_character(value: object) -> StoryPromptCharacter:
    if hasattr(value, "model_dump"):
        value = value.model_dump(mode="json")
    return StoryPromptCharacter.model_validate(value)


def _session_character_refs_by_role(session: CreationSession) -> dict[str, dict]:
    refs: dict[str, dict] = {}
    for ref in session.character_refs or []:
        if not isinstance(ref, dict):
            continue
        role_code = str(ref.get("role_code") or "").strip()
        if role_code:
            refs[role_code] = ref
    return refs


def _storyboard_appearances_for_storage(
    appearances: list[StoryboardCharacterAppearance],
    character_refs_by_role: dict[str, dict],
) -> list[dict]:
    if not character_refs_by_role:
        return [appearance.model_dump(mode="json", exclude_none=True) for appearance in appearances]
    results: list[dict] = []
    for appearance in appearances:
        character_ref = character_refs_by_role.get(appearance.role_code)
        if character_ref is None:
            continue
        results.append(
            StoryboardCharacterAppearance(
                role_code=appearance.role_code,
                display_name=appearance.display_name or character_ref.get("display_name"),
            ).model_dump(mode="json", exclude_none=True)
        )
    return results


def _art_style_prompt_for_session(session: CreationSession) -> str | None:
    art_style_ref = session.art_style_ref or {}
    value = art_style_ref.get("style_prompt") or art_style_ref.get("custom_prompt") or art_style_ref.get("art_style_code")
    prompt = str(value or "").strip()
    return prompt or None


def _page_character_image_refs(
    appearances: list[dict],
    character_refs_by_role: dict[str, dict],
) -> list[PageCharacterImageRef]:
    results: list[PageCharacterImageRef] = []
    for raw_appearance in appearances:
        appearance = StoryboardCharacterAppearance.model_validate(raw_appearance)
        character_ref = character_refs_by_role.get(appearance.role_code, {})
        results.append(
            PageCharacterImageRef(
                role_code=appearance.role_code,
                display_name=appearance.display_name or character_ref.get("display_name"),
                character_id=character_ref.get("character_id"),
                image_url=character_ref.get("image_url"),
            )
        )
    return results


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
    if task.task_type == GenerationTaskType.PAGE_IMAGE:
        _mark_target_pages_failed(session, [_task_page_id(task)], task.task_type)
    elif task.task_type in {GenerationTaskType.IMAGE, GenerationTaskType.AUDIO, GenerationTaskType.LIP_SYNC}:
        _mark_target_pages_failed(session, _task_page_ids(task), task.task_type)
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


def _task_aspect_ratio(task: GenerationTask) -> ImageAspectRatio:
    value = (task.input_payload or {}).get("aspect_ratio")
    if value is None:
        return ImageAspectRatio.LANDSCAPE_STANDARD
    return ImageAspectRatio(value)


def _task_page_id(task: GenerationTask) -> int:
    page_id = (task.input_payload or {}).get("page_id")
    if page_id is None:
        page_ids = _task_page_ids(task)
        if not page_ids or len(page_ids) != 1:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="单页图片任务必须指定一个 page_id")
        return page_ids[0]
    return int(page_id)


def _status_field_for_task(task_type: GenerationTaskType) -> str:
    if task_type in {GenerationTaskType.IMAGE, GenerationTaskType.PAGE_IMAGE}:
        return "image_status"
    if task_type == GenerationTaskType.AUDIO:
        return "audio_status"
    if task_type == GenerationTaskType.LIP_SYNC:
        return "lip_sync_status"
    return "storyboard_status"


def _subtitle_position(value: str) -> BookSubtitlePosition:
    try:
        return BookSubtitlePosition(value)
    except ValueError:
        return BookSubtitlePosition.BOTTOM


def _mark_target_pages_failed(session: CreationSession, page_ids: list[int] | None, task_type: GenerationTaskType) -> None:
    status_field = _status_field_for_task(task_type)
    for page in session.page_drafts:
        if page_ids is None or page.id in page_ids:
            setattr(page, status_field, PageDraftTaskStatus.FAILED)


async def _get_session_model(db: AsyncSession, user_id: int, session_id: int) -> CreationSession:
    result = await db.execute(
        select(CreationSession)
        .options(selectinload(CreationSession.page_drafts))
        .execution_options(populate_existing=True)
        .where(CreationSession.id == session_id, CreationSession.user_id == user_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="创作会话不存在")
    return session
