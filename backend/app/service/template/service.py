from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.model.book import (
    Book,
    BookLearningCard,
    BookModerationStatus,
    BookPage,
    BookPlaybackSegment,
    BookPublishStatus,
    BookReadingPrompt,
    BookSourceType,
    BookSoundEffectCue,
    BookSubtitleCue,
)
from app.model.generation_task import GenerationTaskType
from app.model.generation_task import GenerationTask
from app.model.template import (
    BookTemplate,
    TemplateCharacter,
    TemplateCreationRecord,
    TemplateCreationStatus,
    TemplateReplaceRegion,
    TemplateStatus,
)
from app.schema.generation_task import GenerationTaskCreate
from app.schema.template import (
    TemplateCharacterRead,
    TemplateCreateBookResponse,
    TemplateListRead,
    TemplatePreviewResponse,
    TemplateRead,
    TemplateRegionRead,
    TemplateReplacementRequest,
    TemplateSummary,
    TemplateValidationIssue,
    TemplateValidationResult,
)
from app.service import book as book_service
from app.service import generation_task


async def list_templates(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
) -> TemplateListRead:
    result = await db.execute(
        select(BookTemplate)
        .where(BookTemplate.status == TemplateStatus.PUBLISHED)
        .order_by(BookTemplate.sort_order.desc(), BookTemplate.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    templates = result.scalars().all()
    total = await db.scalar(select(func.count()).select_from(BookTemplate).where(BookTemplate.status == TemplateStatus.PUBLISHED))
    return TemplateListRead(
        items=[await _template_summary(db, template) for template in templates],
        total=total or 0,
        limit=limit,
        offset=offset,
    )


async def get_template(db: AsyncSession, template_id: int) -> TemplateRead:
    template = await _get_template_model(db, template_id)
    characters = await _list_character_reads(db, template.id)
    summary = await _template_summary(db, template)
    return TemplateRead(**summary.model_dump(), characters=characters, created_at=template.created_at, updated_at=template.updated_at)


async def validate_template_replacements(
    db: AsyncSession,
    *,
    user_id: int,
    template_id: int,
    payload: TemplateReplacementRequest,
) -> TemplateValidationResult:
    template = await _get_template_model(db, template_id)
    characters = await _list_characters(db, template.id)
    replacement_by_role = {replacement.role_code: replacement for replacement in payload.replacements}
    known_role_codes = {character.role_code for character in characters}
    issues = [
        TemplateValidationIssue(role_code=replacement.role_code, message="模板不存在该可替换角色")
        for replacement in payload.replacements
        if replacement.role_code not in known_role_codes
    ]
    missing = [
        character.role_code
        for character in characters
        if character.required
        and not (
            replacement_by_role.get(character.role_code)
            and (replacement_by_role[character.role_code].keep_default or replacement_by_role[character.role_code].character_id or replacement_by_role[character.role_code].upload_asset_id)
        )
    ]
    issues.extend(
        TemplateValidationIssue(role_code=role_code, message="必填角色需要选择替换形象或保留默认形象")
        for role_code in missing
    )
    for character in characters:
        replacement = replacement_by_role.get(character.role_code)
        if replacement is None or replacement.keep_default:
            continue
        if replacement.source not in (character.allowed_replacement_sources or []):
            issues.append(TemplateValidationIssue(role_code=character.role_code, message="该角色不允许使用当前替换来源"))
        if replacement.character_id is None and replacement.upload_asset_id is None:
            issues.append(TemplateValidationIssue(role_code=character.role_code, message="替换角色需要提供形象或上传素材"))
    if payload.voice_ref is not None and not template.allow_voice_replacement and payload.voice_ref.source != "template_default":
        issues.append(TemplateValidationIssue(role_code=None, message="该模板不允许替换朗读声音"))
    if payload.voice_ref is not None:
        allowed_voice_scope = _enum_value(template.allowed_voice_scope)
        if allowed_voice_scope == "default_only" and payload.voice_ref.source != "template_default":
            issues.append(TemplateValidationIssue(role_code=None, message="该模板只允许使用默认朗读声音"))
        if allowed_voice_scope == "system" and payload.voice_ref.source == "user":
            issues.append(TemplateValidationIssue(role_code=None, message="该模板不允许使用个人声音"))
        if payload.voice_ref.source != "template_default" and payload.voice_ref.voice_id is None:
            issues.append(TemplateValidationIssue(role_code=None, message="替换朗读声音需要提供 voice_id"))
    return TemplateValidationResult(valid=not issues, missing_required_role_codes=missing, issues=issues)


async def preview_template_replacement(
    db: AsyncSession,
    *,
    user_id: int,
    template_id: int,
    payload: TemplateReplacementRequest,
) -> TemplatePreviewResponse:
    validation = await validate_template_replacements(db, user_id=user_id, template_id=template_id, payload=payload)
    if not validation.valid:
        return TemplatePreviewResponse(validation=validation, task=None)
    record = TemplateCreationRecord(
        user_id=user_id,
        template_id=template_id,
        replacements=payload.model_dump(mode="json"),
        status=TemplateCreationStatus.PREVIEWING,
    )
    db.add(record)
    await db.flush()
    task = await generation_task.create_task(
        db,
        GenerationTaskCreate(
            task_type=GenerationTaskType.TEMPLATE_COMPOSITE,
            owner_type="template",
            owner_id=record.id,
            user_id=user_id,
            input_payload={"template_id": template_id, "mode": "preview"},
        ),
    )
    await db.commit()
    return TemplatePreviewResponse(validation=validation, task=task)


async def create_book_from_template(
    db: AsyncSession,
    *,
    user_id: int,
    template_id: int,
    payload: TemplateReplacementRequest,
) -> TemplateCreateBookResponse:
    validation = await validate_template_replacements(db, user_id=user_id, template_id=template_id, payload=payload)
    if not validation.valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=validation.model_dump())
    record = TemplateCreationRecord(
        user_id=user_id,
        template_id=template_id,
        replacements=payload.model_dump(mode="json"),
        status=TemplateCreationStatus.GENERATING,
    )
    db.add(record)
    await db.flush()
    task = await generation_task.create_task(
        db,
        GenerationTaskCreate(
            task_type=GenerationTaskType.TEMPLATE_COMPOSITE,
            owner_type="template",
            owner_id=record.id,
            user_id=user_id,
            input_payload={"template_id": template_id, "mode": "create_book"},
        ),
    )
    await db.commit()
    return TemplateCreateBookResponse(validation=validation, task=task, book=None)


async def run_template_composite_task(db: AsyncSession, task: GenerationTask) -> None:
    if task.owner_type != "template":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="TEMPLATE_TASK_OWNER_INVALID")
    record = await db.get(TemplateCreationRecord, task.owner_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="模板生成记录不存在")
    mode = str((task.input_payload or {}).get("mode") or "")
    if mode == "preview":
        record.status = TemplateCreationStatus.PREVIEWING
        await generation_task.mark_task_succeeded(
            db,
            task.id,
            result_refs={"template_id": record.template_id, "record_id": record.id, "preview": True},
        )
        return
    if mode == "create_book":
        voice_ref = (record.replacements or {}).get("voice_ref")
        book = await create_personal_book_from_template(
            db,
            user_id=record.user_id,
            template_id=record.template_id,
            voice_ref=voice_ref,
        )
        record.result_book_id = book.id
        record.status = TemplateCreationStatus.SAVED
        await generation_task.mark_task_succeeded(
            db,
            task.id,
            result_refs={"template_id": record.template_id, "record_id": record.id, "book_id": book.id},
        )
        return
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="TEMPLATE_TASK_MODE_INVALID")


async def mark_template_task_failed(db: AsyncSession, task: GenerationTask, exc: BaseException) -> None:
    if task.owner_type != "template":
        return
    record = await db.get(TemplateCreationRecord, task.owner_id)
    if record is not None:
        record.status = TemplateCreationStatus.FAILED
    _ = exc


async def create_personal_book_from_template(
    db: AsyncSession,
    *,
    user_id: int,
    template_id: int,
    voice_ref: dict | None = None,
) -> Book:
    template = await _get_template_model(db, template_id)
    source_book = await _get_source_book_with_content(db, template.source_book_id)
    book = Book(
        owner_user_id=user_id,
        source_type=BookSourceType.TEMPLATE_RESULT,
        source_story_id=source_book.source_story_id,
        title=f"{template.title} - 我的版本",
        subtitle=source_book.subtitle,
        summary=source_book.summary,
        cover_url=source_book.cover_url,
        background_music_url=source_book.background_music_url,
        age_range_codes=list(source_book.age_range_codes or []),
        theme_codes=list(source_book.theme_codes or []),
        education_goal_codes=list(source_book.education_goal_codes or []),
        tags=list(source_book.tags or []),
        language=source_book.language,
        reading_level=source_book.reading_level,
        narrative_style_code=source_book.narrative_style_code,
        art_style_code=source_book.art_style_code,
        default_voice_id=_resolved_voice_id(template, source_book, voice_ref),
        page_count=source_book.page_count,
        duration_seconds=source_book.duration_seconds,
        access_level=source_book.access_level,
        publish_status=BookPublishStatus.PUBLISHED,
        moderation_status=BookModerationStatus.PENDING,
        preview_page_count=source_book.preview_page_count,
    )
    db.add(book)
    await db.flush()
    for source_page in source_book.pages:
        page = BookPage(
            book_id=book.id,
            page_no=source_page.page_no,
            title=source_page.title,
            text_zh=source_page.text_zh,
            text_en=source_page.text_en,
            narration_text=source_page.narration_text,
            visual_prompt=source_page.visual_prompt,
            image_url=source_page.image_url,
            audio_url=source_page.audio_url,
            duration_seconds=source_page.duration_seconds,
        )
        db.add(page)
        await db.flush()
        for source_effect in source_page.sound_effects:
            if source_effect.segment_id is not None:
                continue
            db.add(
                BookSoundEffectCue(
                    page_id=page.id,
                    segment_id=None,
                    trigger_type=source_effect.trigger_type,
                    sound_effect_url=source_effect.sound_effect_url,
                    start_ms=source_effect.start_ms,
                    end_ms=source_effect.end_ms,
                    volume=source_effect.volume,
                    loop=source_effect.loop,
                    sort_order=source_effect.sort_order,
                )
            )
        for source_segment in source_page.playback_segments:
            segment = BookPlaybackSegment(
                page_id=page.id,
                segment_type=source_segment.segment_type,
                speaker_ref=source_segment.speaker_ref,
                image_url=source_segment.image_url,
                audio_url=source_segment.audio_url,
                lip_sync_url=source_segment.lip_sync_url,
                media_mode=source_segment.media_mode,
                start_ms=source_segment.start_ms,
                end_ms=source_segment.end_ms,
                fallback_mode=source_segment.fallback_mode,
                lip_sync_status=source_segment.lip_sync_status,
                sort_order=source_segment.sort_order,
            )
            db.add(segment)
            await db.flush()
            for source_effect in source_segment.sound_effects:
                db.add(
                    BookSoundEffectCue(
                        page_id=page.id,
                        segment_id=segment.id,
                        trigger_type=source_effect.trigger_type,
                        sound_effect_url=source_effect.sound_effect_url,
                        start_ms=source_effect.start_ms,
                        end_ms=source_effect.end_ms,
                        volume=source_effect.volume,
                        loop=source_effect.loop,
                        sort_order=source_effect.sort_order,
                    )
                )
            for source_cue in source_segment.subtitle_cues:
                db.add(
                    BookSubtitleCue(
                        segment_id=segment.id,
                        cue_type=source_cue.cue_type,
                        speaker_ref=source_cue.speaker_ref,
                        start_ms=source_cue.start_ms,
                        end_ms=source_cue.end_ms,
                        text_zh=source_cue.text_zh,
                        text_en=source_cue.text_en,
                        position=source_cue.position,
                        position_config=source_cue.position_config,
                        sort_order=source_cue.sort_order,
                    )
                )
    for prompt in source_book.reading_prompts:
        db.add(
            BookReadingPrompt(
                book_id=book.id,
                prompt_type=prompt.prompt_type,
                content=prompt.content,
                page_no=prompt.page_no,
                status=prompt.status,
                sort_order=prompt.sort_order,
            )
        )
    for card in source_book.learning_cards:
        db.add(
            BookLearningCard(
                book_id=book.id,
                theme=card.theme,
                education_goals=list(card.education_goals or []),
                vocabulary=list(card.vocabulary or []),
                discussion_questions=list(card.discussion_questions or []),
                status=card.status,
                sort_order=card.sort_order,
            )
        )
    await db.flush()
    return book


async def _template_summary(db: AsyncSession, template: BookTemplate) -> TemplateSummary:
    character_count = await db.scalar(select(func.count()).select_from(TemplateCharacter).where(TemplateCharacter.template_id == template.id))
    source_book = await db.get(Book, template.source_book_id)
    return TemplateSummary(
        id=template.id,
        source_book_id=template.source_book_id,
        title=template.title,
        summary=template.summary,
        cover_url=template.cover_url,
        default_voice_id=template.default_voice_id,
        default_voice_name=template.default_voice_name,
        access_level=template.access_level,
        allow_voice_replacement=template.allow_voice_replacement,
        allowed_voice_scope=template.allowed_voice_scope,
        status=template.status,
        validation_status=template.validation_status,
        sort_order=template.sort_order,
        character_count=character_count or 0,
        page_count=source_book.page_count if source_book else None,
    )


async def _list_character_reads(db: AsyncSession, template_id: int) -> list[TemplateCharacterRead]:
    characters = await _list_characters(db, template_id)
    result: list[TemplateCharacterRead] = []
    for character in characters:
        regions_result = await db.execute(
            select(TemplateReplaceRegion)
            .where(TemplateReplaceRegion.template_character_id == character.id)
            .order_by(TemplateReplaceRegion.page_no.asc())
        )
        regions = [TemplateRegionRead.model_validate(region) for region in regions_result.scalars().all()]
        result.append(TemplateCharacterRead.model_validate(character).model_copy(update={"regions": regions}))
    return result


async def _list_characters(db: AsyncSession, template_id: int) -> list[TemplateCharacter]:
    result = await db.execute(
        select(TemplateCharacter)
        .where(TemplateCharacter.template_id == template_id)
        .order_by(TemplateCharacter.sort_order.asc(), TemplateCharacter.id.asc())
    )
    return list(result.scalars().all())


async def _get_template_model(db: AsyncSession, template_id: int) -> BookTemplate:
    template = await db.get(BookTemplate, template_id)
    if template is None or template.status in {TemplateStatus.DELETED, TemplateStatus.UNPUBLISHED}:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="模板不存在")
    source_book = await db.get(Book, template.source_book_id)
    if source_book is None or source_book.publish_status == BookPublishStatus.DELETED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="模板原绘本不存在")
    return template


async def _get_source_book_with_content(db: AsyncSession, book_id: int) -> Book:
    result = await db.execute(
        select(Book)
        .options(
            selectinload(Book.pages)
            .selectinload(BookPage.playback_segments)
            .selectinload(BookPlaybackSegment.subtitle_cues),
            selectinload(Book.pages).selectinload(BookPage.sound_effects),
            selectinload(Book.pages)
            .selectinload(BookPage.playback_segments)
            .selectinload(BookPlaybackSegment.sound_effects),
            selectinload(Book.reading_prompts),
            selectinload(Book.learning_cards),
        )
        .where(Book.id == book_id)
    )
    book = result.scalar_one_or_none()
    if book is None or book.publish_status != BookPublishStatus.PUBLISHED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="模板原绘本不存在")
    return book


def _resolved_voice_id(template: BookTemplate, source_book: Book, voice_ref: dict | None) -> int | None:
    if voice_ref and voice_ref.get("source") != "template_default":
        return voice_ref.get("voice_id")
    return template.default_voice_id or source_book.default_voice_id


def _enum_value(value: object) -> str:
    enum_value = getattr(value, "value", value)
    return str(enum_value)
