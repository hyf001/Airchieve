from collections.abc import Mapping
from datetime import datetime, timezone
from time import perf_counter

from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.model.ai_provider import (
    AiProviderCall,
    AiProviderCallStatus,
    AiProviderCapability,
    AiProviderUsageRecord,
    AiProviderUsageType,
)
from app.model.taxonomy import TaxonomyType
from app.schema.ai_provider import (
    AudioGenerationRequest,
    CharacterPortraitInput,
    GeneratedStoryContent,
    ImageAspectRatio,
    ImageGenerationRequest,
    LipSyncGenerationRequest,
    PageAudioResult,
    PageImageResult,
    PageLipSyncResult,
    PageMediaInput,
    PageSegmentAudioResult,
    PageSegmentLipSyncResult,
    PictureBookAudioResult,
    PictureBookImageResult,
    PictureBookLipSyncResult,
    PictureBookStoryboard,
    PictureBookStoryboardRequest,
    StoryGenerationRequest,
    StoryPromptCharacter,
    StoryboardPlaybackSegment,
    StoryboardPlaybackSegmentType,
    VoicePromptRef,
)
from app.schema.taxonomy import TaxonomyItemRead
from app.service.ai_provider.errors import AiProviderError
from app.service.ai_provider.parsers import story_from_response, story_text_from_response, storyboard_from_response
from app.service.ai_provider.providers import (
    aliyun_generate_audio,
    doubao_create_picture_book_storyboard,
    doubao_create_story_content,
    doubao_draft_story_text,
    doubao_generate_audio,
    doubao_generate_image,
    doubao_generate_images,
    gemini_create_picture_book_storyboard,
    gemini_create_story_content,
    gemini_draft_story_text,
    gemini_generate_audio,
    gemini_generate_image,
    gemini_generate_images,
    kling_generate_audio,
    kling_generate_lip_sync,
)
from app.service.taxonomy import list_taxonomy


DEFAULT_RECORD_PROVIDER = "unconfigured"
DEFAULT_RECORD_MODEL = "unconfigured"


class _StoryTaxonomyLabels(BaseModel):
    age_ranges: list[str]
    themes: list[str]
    narrative_style: str | None = None


async def record_provider_call(
    db: AsyncSession,
    *,
    capability: AiProviderCapability,
    task_id: int | None,
    request_payload: Mapping[str, object],
    response_payload: Mapping[str, object] | None,
    provider: str = DEFAULT_RECORD_PROVIDER,
    model: str = DEFAULT_RECORD_MODEL,
    status: AiProviderCallStatus = AiProviderCallStatus.SUCCEEDED,
    latency_ms: int | None = None,
    error_code: str | None = None,
    error_message: str | None = None,
) -> AiProviderCall:
    call = AiProviderCall(
        task_id=task_id,
        provider=provider,
        model=model,
        capability=capability,
        request_payload_snapshot=_snapshot(request_payload),
        response_payload_snapshot=_snapshot(response_payload or {}),
        status=status,
        latency_ms=latency_ms,
        error_code=error_code,
        error_message=error_message,
    )
    db.add(call)
    await db.flush()
    if status == AiProviderCallStatus.SUCCEEDED:
        usage = AiProviderUsageRecord(
            provider_call_id=call.id,
            provider=provider,
            model=model,
            usage_type=AiProviderUsageType.REQUEST_COUNT,
            usage_amount=1,
            estimated_cost=0,
            currency="USD",
            occurred_at=datetime.now(timezone.utc),
        )
        db.add(usage)
    return call


async def draft_story_text_from_prompt(db: AsyncSession, *, task_id: int | None, prompt: str) -> str:
    provider = _provider_for(AiProviderCapability.TEXT)
    model = _model_for(provider, AiProviderCapability.TEXT)
    started = perf_counter()
    request_snapshot = {"prompt_preview": prompt[:120]}
    try:
        raw_text = await _draft_story_text_with_provider(provider, model, prompt)
        result = story_text_from_response(raw_text, fallback_title=prompt.strip()[:40])
        await record_provider_call(
            db,
            capability=AiProviderCapability.TEXT,
            task_id=task_id,
            provider=provider,
            model=model,
            request_payload=request_snapshot,
            response_payload={"text_preview": result[:120]},
            latency_ms=_elapsed_ms(started),
        )
        return result
    except Exception as exc:
        await _record_provider_failure(
            db,
            capability=AiProviderCapability.TEXT,
            task_id=task_id,
            provider=provider,
            model=model,
            started=started,
            request_payload=request_snapshot,
            exc=exc,
        )
        raise


async def create_story_content(
    db: AsyncSession,
    *,
    task_id: int | None,
    idea_prompt: str,
    characters: list[StoryPromptCharacter] | None = None,
    target_word_count: int = 800,
    language: str,
    age_range_codes: list[str] | None = None,
    theme_codes: list[str] | None = None,
    narrative_style_code: str | None = None,
) -> GeneratedStoryContent:
    provider = _provider_for(AiProviderCapability.TEXT)
    model = _model_for(provider, AiProviderCapability.TEXT)
    started = perf_counter()
    fallback_title = idea_prompt.strip()[:40] or "专属故事"
    fallback_summary = idea_prompt.strip()[:120]
    taxonomy_labels = await _story_taxonomy_labels(
        db,
        age_range_codes=age_range_codes or [],
        theme_codes=theme_codes or [],
        narrative_style_code=narrative_style_code,
    )
    request = StoryGenerationRequest(
        idea_prompt=idea_prompt,
        characters=characters or [],
        target_word_count=target_word_count,
        language=language,
        age_ranges=taxonomy_labels.age_ranges,
        themes=taxonomy_labels.themes,
        narrative_style=taxonomy_labels.narrative_style,
    )
    request_snapshot = {
        "idea_preview": idea_prompt[:120],
        "language": language,
        "characters": [character.model_dump(mode="json", exclude_none=True) for character in characters or []],
        "target_word_count": target_word_count,
        "age_range_codes": age_range_codes or [],
        "theme_codes": theme_codes or [],
        "narrative_style_code": narrative_style_code,
    }
    try:
        raw_response = await _create_story_content_with_provider(
            provider,
            model,
            request,
        )
        result = story_from_response(raw_response, fallback_title=fallback_title, fallback_summary=fallback_summary)
        await record_provider_call(
            db,
            capability=AiProviderCapability.TEXT,
            task_id=task_id,
            provider=provider,
            model=model,
            request_payload=request_snapshot,
            response_payload={
                "title": result.title,
                "summary_preview": result.summary[:120],
                "characters": [character.model_dump(mode="json", exclude_none=True) for character in result.characters],
            },
            latency_ms=_elapsed_ms(started),
        )
        return result
    except Exception as exc:
        await _record_provider_failure(
            db,
            capability=AiProviderCapability.TEXT,
            task_id=task_id,
            provider=provider,
            model=model,
            started=started,
            request_payload=request_snapshot,
            exc=exc,
        )
        raise


async def create_picture_book_storyboard(
    db: AsyncSession,
    *,
    task_id: int | None,
    request: PictureBookStoryboardRequest,
) -> PictureBookStoryboard:
    provider = _provider_for(AiProviderCapability.STRUCTURED)
    model = _model_for(provider, AiProviderCapability.STRUCTURED)
    started = perf_counter()
    page_count = request.target_page_count
    title = request.title or "专属绘本"
    story_content = request.story_content
    characters = request.characters
    request_snapshot = {
        "target_page_count": page_count,
        "title": title,
        "story_preview": story_content[:120],
        "characters": [character.model_dump(mode="json", exclude_none=True) for character in characters],
    }
    try:
        raw_response = await _create_picture_book_storyboard_with_provider(
            provider,
            model,
            request,
        )
        response = storyboard_from_response(raw_response, title=title, page_count=page_count)
        await record_provider_call(
            db,
            capability=AiProviderCapability.STRUCTURED,
            task_id=task_id,
            provider=provider,
            model=model,
            request_payload=request_snapshot,
            response_payload={"page_count": len(response.pages)},
            latency_ms=_elapsed_ms(started),
        )
        return response
    except Exception as exc:
        await _record_provider_failure(
            db,
            capability=AiProviderCapability.STRUCTURED,
            task_id=task_id,
            provider=provider,
            model=model,
            started=started,
            request_payload=request_snapshot,
            exc=exc,
        )
        raise


async def create_picture_book_page_images(
    db: AsyncSession,
    *,
    task_id: int | None,
    pages: list[PageMediaInput],
    aspect_ratio: ImageAspectRatio = ImageAspectRatio.LANDSCAPE_STANDARD,
) -> PictureBookImageResult:
    provider = _provider_for(AiProviderCapability.IMAGE)
    model = _model_for(provider, AiProviderCapability.IMAGE)
    started = perf_counter()
    request_snapshot = {
        "page_ids": [page.id for page in pages],
        "page_count": len(pages),
        "aspect_ratio": aspect_ratio.value,
        "character_reference_image_count": len(_all_character_image_urls(pages)),
        "continuity_reference_image_count": len(_continuity_image_urls(pages)),
    }
    try:
        total = len(pages)
        request = ImageGenerationRequest(kind="picture_book_pages", pages=pages, image_count=total, aspect_ratio=aspect_ratio)
        generated_images = await _generate_images_with_provider(
            provider,
            model,
            request,
        )
        if len(generated_images) < total:
            raise AiProviderError(
                f"图片模型返回数量不足：需要 {total} 张，实际 {len(generated_images)} 张",
                error_code="IMAGE_RESULT_COUNT_MISMATCH",
            )
        results = [
            PageImageResult(page_id=page.id, image_url=generated_images[index])
            for index, page in enumerate(pages)
        ]
        response = PictureBookImageResult(page_results=results)
        await record_provider_call(
            db,
            capability=AiProviderCapability.IMAGE,
            task_id=task_id,
            provider=provider,
            model=model,
            request_payload=request_snapshot,
            response_payload={"page_count": len(results)},
            latency_ms=_elapsed_ms(started),
        )
        return response
    except Exception as exc:
        await _record_provider_failure(
            db,
            capability=AiProviderCapability.IMAGE,
            task_id=task_id,
            provider=provider,
            model=model,
            started=started,
            request_payload=request_snapshot,
            exc=exc,
        )
        raise


async def create_picture_book_single_page_image(
    db: AsyncSession,
    *,
    task_id: int | None,
    page: PageMediaInput,
    aspect_ratio: ImageAspectRatio = ImageAspectRatio.LANDSCAPE_STANDARD,
) -> PictureBookImageResult:
    provider = _provider_for(AiProviderCapability.IMAGE)
    model = _model_for(provider, AiProviderCapability.IMAGE)
    started = perf_counter()
    request_snapshot = {
        "page_id": page.id,
        "aspect_ratio": aspect_ratio.value,
        "character_reference_image_count": len(_all_character_image_urls([page])),
        "continuity_reference_image_count": len(_continuity_image_urls([page])),
    }
    try:
        request = ImageGenerationRequest(kind="picture_book_single_page", pages=[page], image_count=1, aspect_ratio=aspect_ratio)
        image_url = await _generate_image_with_provider(
            provider,
            model,
            request,
        )
        response = PictureBookImageResult(page_results=[PageImageResult(page_id=page.id, image_url=image_url)])
        await record_provider_call(
            db,
            capability=AiProviderCapability.IMAGE,
            task_id=task_id,
            provider=provider,
            model=model,
            request_payload=request_snapshot,
            response_payload={"page_count": 1},
            latency_ms=_elapsed_ms(started),
        )
        return response
    except Exception as exc:
        await _record_provider_failure(
            db,
            capability=AiProviderCapability.IMAGE,
            task_id=task_id,
            provider=provider,
            model=model,
            started=started,
            request_payload=request_snapshot,
            exc=exc,
        )
        raise


async def create_character_portrait(
    db: AsyncSession,
    *,
    task_id: int | None,
    character: CharacterPortraitInput,
) -> str:
    provider = _provider_for(AiProviderCapability.IMAGE)
    model = _model_for(provider, AiProviderCapability.IMAGE)
    started = perf_counter()
    request = ImageGenerationRequest(kind="character_portrait", character=character, image_count=1)
    request_snapshot = {
        "character_name": character.name,
        "prompt_preview": (character.generation_prompt or character.description or "")[:120],
        "has_reference_image": bool(character.reference_image_url),
        "has_art_style_prompt": bool(character.art_style_prompt),
        "reference_image_policy": character.reference_image_policy,
    }
    try:
        image_url = await _generate_image_with_provider(
            provider,
            model,
            request,
        )
        await record_provider_call(
            db,
            capability=AiProviderCapability.IMAGE,
            task_id=task_id,
            provider=provider,
            model=model,
            request_payload=request_snapshot,
            response_payload={"image_result_type": "data_url" if image_url.startswith("data:") else "url"},
            latency_ms=_elapsed_ms(started),
        )
        return image_url
    except Exception as exc:
        await _record_provider_failure(
            db,
            capability=AiProviderCapability.IMAGE,
            task_id=task_id,
            provider=provider,
            model=model,
            started=started,
            request_payload=request_snapshot,
            exc=exc,
        )
        raise


async def create_picture_book_page_audio(
    db: AsyncSession,
    *,
    task_id: int | None,
    pages: list[PageMediaInput],
    voice_ref: VoicePromptRef | None = None,
) -> PictureBookAudioResult:
    provider = _provider_for(AiProviderCapability.AUDIO)
    model = _model_for(provider, AiProviderCapability.AUDIO)
    started = perf_counter()
    request_snapshot = {
        "page_ids": [page.id for page in pages],
        "page_count": len(pages),
        "voice_source": voice_ref.source if voice_ref else None,
        "voice_id": voice_ref.voice_id if voice_ref else None,
        "provider_voice_id": voice_ref.provider_voice_id if voice_ref else None,
        "emotion_type": voice_ref.emotion_type if voice_ref else None,
        "page_voice_refs": [
            {
                "page_id": page.id,
                "voice_id": (page.voice_config or voice_ref).voice_id if page.voice_config or voice_ref else None,
                "provider_voice_id": (page.voice_config or voice_ref).provider_voice_id if page.voice_config or voice_ref else None,
            }
            for page in pages
        ],
    }
    try:
        results: list[PageAudioResult] = []
        for page in pages:
            page_voice_ref = page.voice_config or voice_ref
            if page.playback_segments:
                segment_results: list[PageSegmentAudioResult] = []
                for segment in _ordered_playback_segments(page):
                    audio_url = await _generate_audio_with_provider(provider, model, segment.text, voice_ref=_voice_ref_for_segment(page_voice_ref, segment))
                    segment_results.append(PageSegmentAudioResult(sort_order=segment.sort_order, audio_url=audio_url))
                if not segment_results:
                    raise AiProviderError(f"第 {page.page_no or page.id} 页缺少可生成语音的播放片段", error_code="AUDIO_SEGMENTS_MISSING")
                page_audio_url = segment_results[0].audio_url
                results.append(PageAudioResult(page_id=page.id, audio_url=page_audio_url, segment_results=segment_results))
            else:
                narration_text = _narration_text_for_page(page)
                audio_url = await _generate_audio_with_provider(provider, model, narration_text, voice_ref=page_voice_ref)
                results.append(PageAudioResult(page_id=page.id, audio_url=audio_url))
        response = PictureBookAudioResult(page_results=results)
        await record_provider_call(
            db,
            capability=AiProviderCapability.AUDIO,
            task_id=task_id,
            provider=provider,
            model=model,
            request_payload=request_snapshot,
            response_payload={"page_count": len(results)},
            latency_ms=_elapsed_ms(started),
        )
        return response
    except Exception as exc:
        await _record_provider_failure(
            db,
            capability=AiProviderCapability.AUDIO,
            task_id=task_id,
            provider=provider,
            model=model,
            started=started,
            request_payload=request_snapshot,
            exc=exc,
        )
        raise


async def create_voice_sample_audio(
    db: AsyncSession,
    *,
    text: str,
    voice_ref: VoicePromptRef | None = None,
    provider: str | None = None,
) -> str:
    provider = (provider or _provider_for(AiProviderCapability.AUDIO)).strip().lower()
    model = _model_for(provider, AiProviderCapability.AUDIO)
    started = perf_counter()
    request_snapshot = {
        "text_preview": text[:120],
        "voice_source": voice_ref.source if voice_ref else None,
        "voice_id": voice_ref.voice_id if voice_ref else None,
        "provider_voice_id": voice_ref.provider_voice_id if voice_ref else None,
        "emotion_type": voice_ref.emotion_type if voice_ref else None,
    }
    try:
        audio_url = await _generate_audio_with_provider(provider, model, text, voice_ref=voice_ref)
        await record_provider_call(
            db,
            capability=AiProviderCapability.AUDIO,
            task_id=None,
            provider=provider,
            model=model,
            request_payload=request_snapshot,
            response_payload={"sample": True},
            latency_ms=_elapsed_ms(started),
        )
        return audio_url
    except Exception as exc:
        await _record_provider_failure(
            db,
            capability=AiProviderCapability.AUDIO,
            task_id=None,
            provider=provider,
            model=model,
            started=started,
            request_payload=request_snapshot,
            exc=exc,
        )
        raise


async def create_picture_book_page_lip_sync(
    db: AsyncSession,
    *,
    task_id: int | None,
    pages: list[PageMediaInput],
) -> PictureBookLipSyncResult:
    provider = _provider_for(AiProviderCapability.LIP_SYNC)
    model = _model_for(provider, AiProviderCapability.LIP_SYNC)
    started = perf_counter()
    request_snapshot = {
        "page_ids": [page.id for page in pages],
        "page_count": len(pages),
    }
    try:
        results: list[PageLipSyncResult] = []
        for page in pages:
            image_url = _public_url_for_page(page, key="image_url", error_code="LIP_SYNC_IMAGE_URL_MISSING")
            dialogue_segments = [
                segment
                for segment in _ordered_playback_segments(page)
                if segment.segment_type == StoryboardPlaybackSegmentType.DIALOGUE
            ]
            if not dialogue_segments:
                results.append(PageLipSyncResult(page_id=page.id, lip_sync_url="", segment_results=[]))
                continue
            segment_results: list[PageSegmentLipSyncResult] = []
            for segment in dialogue_segments:
                audio_url = _public_url_for_segment(page, segment)
                lip_sync_url = await _generate_lip_sync_with_provider(
                    provider,
                    model,
                    request=LipSyncGenerationRequest(
                        page=_page_for_lip_sync_segment(page, segment),
                        audio_url=audio_url,
                        image_url=image_url,
                    ),
                )
                segment_results.append(PageSegmentLipSyncResult(sort_order=segment.sort_order, lip_sync_url=lip_sync_url))
            page_lip_sync_url = segment_results[0].lip_sync_url if segment_results else ""
            results.append(PageLipSyncResult(page_id=page.id, lip_sync_url=page_lip_sync_url, segment_results=segment_results))
        response = PictureBookLipSyncResult(page_results=results)
        await record_provider_call(
            db,
            capability=AiProviderCapability.LIP_SYNC,
            task_id=task_id,
            provider=provider,
            model=model,
            request_payload=request_snapshot,
            response_payload={"page_count": len(results)},
            latency_ms=_elapsed_ms(started),
        )
        return response
    except Exception as exc:
        await _record_provider_failure(
            db,
            capability=AiProviderCapability.LIP_SYNC,
            task_id=task_id,
            provider=provider,
            model=model,
            started=started,
            request_payload=request_snapshot,
            exc=exc,
        )
        raise


async def _draft_story_text_with_provider(provider: str, model: str, prompt: str) -> str:
    if provider == "gemini":
        return await gemini_draft_story_text(model, prompt)
    if provider == "doubao":
        return await doubao_draft_story_text(model, prompt)
    raise AiProviderError(f"不支持的 AI provider: {provider}", error_code="UNSUPPORTED_PROVIDER")


async def _create_story_content_with_provider(provider: str, model: str, request: StoryGenerationRequest) -> GeneratedStoryContent | str:
    if provider == "gemini":
        return await gemini_create_story_content(model, request)
    if provider == "doubao":
        return await doubao_create_story_content(model, request)
    raise AiProviderError(f"不支持的故事 AI provider: {provider}", error_code="UNSUPPORTED_PROVIDER")


async def _create_picture_book_storyboard_with_provider(
    provider: str,
    model: str,
    request: PictureBookStoryboardRequest,
) -> PictureBookStoryboard | str:
    if provider == "gemini":
        return await gemini_create_picture_book_storyboard(model, request)
    if provider == "doubao":
        return await doubao_create_picture_book_storyboard(model, request)
    raise AiProviderError(f"不支持的分镜 AI provider: {provider}", error_code="UNSUPPORTED_PROVIDER")


async def _generate_image_with_provider(
    provider: str,
    model: str,
    request: ImageGenerationRequest,
) -> str:
    if provider == "gemini":
        return await gemini_generate_image(model, request)
    if provider == "doubao":
        return await doubao_generate_image(model, request)
    raise AiProviderError(f"不支持的图片 AI provider: {provider}", error_code="UNSUPPORTED_PROVIDER")


async def _generate_images_with_provider(
    provider: str,
    model: str,
    request: ImageGenerationRequest,
) -> list[str]:
    if provider == "gemini":
        return await gemini_generate_images(model, request)
    if provider == "doubao":
        return await doubao_generate_images(model, request)
    raise AiProviderError(f"不支持的图片 AI provider: {provider}", error_code="UNSUPPORTED_PROVIDER")


async def _generate_audio_with_provider(provider: str, model: str, text: str, *, voice_ref: VoicePromptRef | None) -> str:
    request = AudioGenerationRequest(text=text, voice_ref=voice_ref)
    resolved_voice_ref = request.voice_ref
    if provider == "gemini":
        return await gemini_generate_audio(model, request)
    if provider == "doubao":
        return await doubao_generate_audio(request)
    if provider == "aliyun":
        if not _has_voice_ref_value(resolved_voice_ref):
            raise AiProviderError("阿里云 TTS 需要从声音模块选择带 voice_style_code 的系统声音", error_code="ALIYUN_TTS_VOICE_MISSING")
        return await aliyun_generate_audio(request)
    if provider == "kling":
        if not _has_voice_ref_value(resolved_voice_ref):
            raise AiProviderError("可灵 TTS 需要从声音模块选择带 voice_style_code 的系统声音", error_code="KLING_TTS_VOICE_MISSING")
        return await kling_generate_audio(request)
    raise AiProviderError(f"不支持的语音 AI provider: {provider}", error_code="UNSUPPORTED_PROVIDER")


async def _generate_lip_sync_with_provider(
    provider: str,
    model: str,
    *,
    request: LipSyncGenerationRequest,
) -> str:
    if provider in {"kling", "kling_avatar"}:
        return await kling_generate_lip_sync(
            model,
            request=request,
        )
    raise AiProviderError(f"不支持的对口型 AI provider: {provider}", error_code="UNSUPPORTED_PROVIDER")


def _has_voice_ref_value(voice_ref: VoicePromptRef | None) -> bool:
    if not voice_ref:
        return False
    return any(str(value or "").strip() for value in (voice_ref.provider_voice_id, voice_ref.voice_type, voice_ref.voice_name))


def _voice_ref_for_segment(default_voice_ref: VoicePromptRef | None, segment: StoryboardPlaybackSegment) -> VoicePromptRef | None:
    if default_voice_ref is None:
        return None
    role_code = "narration" if segment.segment_type == StoryboardPlaybackSegmentType.NARRATION else str(segment.speaker_ref or "").strip()
    if not role_code:
        return default_voice_ref
    for role_voice_ref in default_voice_ref.role_voice_refs:
        if role_voice_ref.role_code == role_code:
            return role_voice_ref
    return default_voice_ref


def _narration_text_for_page(page: PageMediaInput) -> str:
    text = str(page.text_zh or page.text_en or "").strip()
    if not text:
        raise AiProviderError(f"第 {page.page_no or page.id} 页缺少朗读文本", error_code="AUDIO_TEXT_MISSING")
    return text


def _ordered_playback_segments(page: PageMediaInput) -> list[StoryboardPlaybackSegment]:
    return sorted(page.playback_segments, key=lambda segment: segment.sort_order)


def _public_url_for_segment(page: PageMediaInput, segment: StoryboardPlaybackSegment) -> str:
    url = _optional_public_url(segment.audio_url)
    if url:
        return url
    label = page.page_no or page.id
    raise AiProviderError(f"第 {label} 页第 {segment.sort_order} 段缺少公网可访问的 audio_url", error_code="LIP_SYNC_SEGMENT_AUDIO_URL_MISSING")


def _page_for_lip_sync_segment(page: PageMediaInput, segment: StoryboardPlaybackSegment) -> PageMediaInput:
    return page.model_copy(update={"text_zh": segment.text})


def _public_url_for_page(page: PageMediaInput, *, key: str, error_code: str) -> str:
    value = _optional_public_url(getattr(page, key))
    if value:
        return value
    label = page.page_no or page.id
    raise AiProviderError(f"第 {label} 页缺少公网可访问的 {key}", error_code=error_code)


def _optional_public_url(value: object, *, allow_data_url: bool = False) -> str | None:
    url = str(value or "").strip()
    if url.startswith("http://") or url.startswith("https://"):
        return url
    if allow_data_url and url.startswith("data:image/"):
        return url
    return None


def _all_character_image_urls(pages: list[PageMediaInput]) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()
    for page in pages:
        for appearance in page.all_character_refs:
            url = _optional_public_url(appearance.image_url, allow_data_url=True)
            if url and url not in seen:
                urls.append(url)
                seen.add(url)
    return urls


def _continuity_image_urls(pages: list[PageMediaInput]) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()
    for page in pages:
        for raw_url in page.continuity_image_urls:
            url = _optional_public_url(raw_url, allow_data_url=True)
            if url and url not in seen:
                urls.append(url)
                seen.add(url)
    return urls


async def _story_taxonomy_labels(
    db: AsyncSession,
    *,
    age_range_codes: list[str],
    theme_codes: list[str],
    narrative_style_code: str | None,
) -> _StoryTaxonomyLabels:
    age_ranges = await _taxonomy_labels_for_codes(db, TaxonomyType.AGE_RANGE, age_range_codes)
    themes = await _taxonomy_labels_for_codes(db, TaxonomyType.THEME, theme_codes)
    narrative_styles = await _taxonomy_labels_for_codes(
        db,
        TaxonomyType.NARRATIVE_STYLE,
        [narrative_style_code] if narrative_style_code else [],
    )
    return _StoryTaxonomyLabels(
        age_ranges=age_ranges,
        themes=themes,
        narrative_style=narrative_styles[0] if narrative_styles else None,
    )


async def _taxonomy_labels_for_codes(db: AsyncSession, taxonomy_type: TaxonomyType, codes: list[str]) -> list[str]:
    if not codes:
        return []
    items = await list_taxonomy(db, taxonomy_type=taxonomy_type)
    items_by_code = {item.code: item for item in items}
    return [_taxonomy_label(items_by_code.get(code), fallback_code=code) for code in codes]


def _taxonomy_label(item: TaxonomyItemRead | None, *, fallback_code: str) -> str:
    if item is None:
        return fallback_code
    label = item.name
    if item.name_en:
        label = f"{label} / {item.name_en}"
    if item.description:
        label = f"{label}：{item.description}"
    return label


def _provider_for(capability: AiProviderCapability) -> str:
    explicit = {
        AiProviderCapability.TEXT: settings.AI_PROVIDER_TEXT,
        AiProviderCapability.STRUCTURED: settings.AI_PROVIDER_STRUCTURED,
        AiProviderCapability.IMAGE: settings.AI_PROVIDER_IMAGE,
        AiProviderCapability.AUDIO: settings.AI_PROVIDER_AUDIO,
        AiProviderCapability.LIP_SYNC: settings.AI_PROVIDER_LIP_SYNC,
    }.get(capability)
    provider = (explicit or settings.AI_PROVIDER_DEFAULT or "").strip().lower()
    if not provider:
        raise AiProviderError("AI_PROVIDER_DEFAULT 未配置", error_code="AI_PROVIDER_NOT_CONFIGURED")
    return provider


def _model_for(provider: str, capability: AiProviderCapability) -> str:
    if provider == "gemini":
        if capability == AiProviderCapability.IMAGE:
            return settings.GEMINI_IMAGE_MODEL
        if capability == AiProviderCapability.AUDIO:
            return settings.GEMINI_TTS_MODEL
        return settings.GEMINI_TEXT_MODEL
    if provider == "doubao":
        if capability == AiProviderCapability.IMAGE:
            return settings.DOUBAO_IMAGE_MODEL or settings.DOUBAO_TEXT_MODEL or "doubao-image"
        if capability == AiProviderCapability.AUDIO:
            return "doubao-tts"
        return settings.DOUBAO_TEXT_MODEL or ""
    if provider == "aliyun":
        if capability == AiProviderCapability.AUDIO:
            return "aliyun-nls-tts"
        raise AiProviderError(f"阿里云语音合成不支持该能力: {capability}", error_code="UNSUPPORTED_PROVIDER")
    if provider in {"kling", "kling_avatar"}:
        if capability == AiProviderCapability.LIP_SYNC:
            return settings.KLING_AVATAR_MODE
        if capability == AiProviderCapability.AUDIO and provider == "kling":
            return "kling-tts"
        raise AiProviderError(f"可灵不支持该能力: {capability}", error_code="UNSUPPORTED_PROVIDER")
    raise AiProviderError(f"不支持的 AI provider: {provider}", error_code="UNSUPPORTED_PROVIDER")


async def _record_provider_failure(
    db: AsyncSession,
    *,
    capability: AiProviderCapability,
    task_id: int | None,
    provider: str,
    model: str,
    started: float,
    request_payload: Mapping[str, object],
    exc: Exception,
) -> None:
    error_code = getattr(exc, "error_code", exc.__class__.__name__)
    await record_provider_call(
        db,
        capability=capability,
        task_id=task_id,
        provider=provider,
        model=model,
        request_payload=request_payload,
        response_payload={},
        status=AiProviderCallStatus.FAILED,
        latency_ms=_elapsed_ms(started),
        error_code=str(error_code)[:80],
        error_message=str(exc)[:1000],
    )


def _elapsed_ms(started: float) -> int:
    return round((perf_counter() - started) * 1000)


def _snapshot(payload: Mapping[str, object]) -> Mapping[str, object]:
    return {key: value for key, value in payload.items() if key not in {"api_key", "secret", "raw_body"}}
