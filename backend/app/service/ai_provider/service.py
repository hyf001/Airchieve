from datetime import datetime, timezone
from time import perf_counter

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.model.ai_provider import (
    AiProviderCall,
    AiProviderCallStatus,
    AiProviderCapability,
    AiProviderUsageRecord,
    AiProviderUsageType,
)
from app.service.ai_provider.errors import AiProviderError
from app.service.ai_provider.parsers import story_text_from_response, storyboard_from_response
from app.service.ai_provider.prompts import build_storyboard_prompt
from app.service.ai_provider.providers import (
    doubao_generate_audio,
    doubao_generate_image,
    doubao_generate_text,
    gemini_generate_audio,
    gemini_generate_image,
    gemini_generate_text,
    kling_avatar_generate_lip_sync,
)


DEFAULT_RECORD_PROVIDER = "unconfigured"
DEFAULT_RECORD_MODEL = "unconfigured"


async def record_provider_call(
    db: AsyncSession,
    *,
    capability: AiProviderCapability,
    task_id: int | None,
    request_payload: dict,
    response_payload: dict | None,
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


async def generate_text(db: AsyncSession, *, task_id: int | None, prompt: str) -> str:
    provider = _provider_for(AiProviderCapability.TEXT)
    model = _model_for(provider, AiProviderCapability.TEXT)
    started = perf_counter()
    request_snapshot = {"prompt_preview": prompt[:120]}
    try:
        raw_text = await _generate_text_with_provider(provider, model, prompt)
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


async def generate_structured(db: AsyncSession, *, task_id: int | None, request: dict) -> dict:
    provider = _provider_for(AiProviderCapability.STRUCTURED)
    model = _model_for(provider, AiProviderCapability.STRUCTURED)
    started = perf_counter()
    page_count = int(request.get("target_page_count") or 8)
    title = str(request.get("title") or "专属绘本")
    story_content = str(request.get("story_content") or request.get("story_body") or title)
    request_snapshot = {
        "target_page_count": page_count,
        "title": title,
        "story_preview": story_content[:120],
    }
    try:
        prompt = build_storyboard_prompt(title=title, story_content=story_content, page_count=page_count)
        raw_text = await _generate_text_with_provider(provider, model, prompt, response_json=True)
        response = storyboard_from_response(raw_text, title=title, page_count=page_count)
        await record_provider_call(
            db,
            capability=AiProviderCapability.STRUCTURED,
            task_id=task_id,
            provider=provider,
            model=model,
            request_payload=request_snapshot,
            response_payload={"page_count": len(response["pages"])},
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


async def generate_image(db: AsyncSession, *, task_id: int | None, pages: list[dict]) -> dict:
    provider = _provider_for(AiProviderCapability.IMAGE)
    model = _model_for(provider, AiProviderCapability.IMAGE)
    started = perf_counter()
    request_snapshot = {
        "page_ids": [page["id"] for page in pages],
        "page_count": len(pages),
    }
    try:
        results = []
        total = len(pages)
        for index, page in enumerate(pages):
            prompt = _build_picture_book_image_prompt(page, page_index=index, page_count=total)
            image_url = await _generate_image_with_provider(provider, model, prompt)
            results.append({"page_id": page["id"], "image_url": image_url})
        response = {"page_results": results}
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


async def generate_audio(db: AsyncSession, *, task_id: int | None, pages: list[dict], voice_ref: dict | None = None) -> dict:
    provider = _provider_for(AiProviderCapability.AUDIO)
    model = _model_for(provider, AiProviderCapability.AUDIO)
    started = perf_counter()
    request_snapshot = {
        "page_ids": [page["id"] for page in pages],
        "page_count": len(pages),
        "voice_source": (voice_ref or {}).get("source"),
        "voice_id": (voice_ref or {}).get("voice_id"),
    }
    try:
        results = []
        for page in pages:
            narration_text = _narration_text_for_page(page)
            audio_url = await _generate_audio_with_provider(provider, model, narration_text, voice_ref=voice_ref)
            results.append({"page_id": page["id"], "audio_url": audio_url})
        response = {"page_results": results}
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


async def generate_lip_sync(db: AsyncSession, *, task_id: int | None, pages: list[dict]) -> dict:
    provider = _provider_for(AiProviderCapability.LIP_SYNC)
    model = _model_for(provider, AiProviderCapability.LIP_SYNC)
    started = perf_counter()
    request_snapshot = {
        "page_ids": [page["id"] for page in pages],
        "page_count": len(pages),
    }
    try:
        results = []
        for page in pages:
            audio_url = _public_url_for_page(page, key="audio_url", error_code="LIP_SYNC_AUDIO_URL_MISSING")
            image_url = _public_url_for_page(page, key="image_url", error_code="LIP_SYNC_IMAGE_URL_MISSING")
            lip_sync_url = await _generate_lip_sync_with_provider(
                provider,
                model,
                audio_url=audio_url,
                image_url=image_url,
                prompt=_build_avatar_prompt(page),
            )
            results.append({"page_id": page["id"], "lip_sync_url": lip_sync_url})
        response = {"page_results": results}
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


async def _generate_text_with_provider(
    provider: str,
    model: str,
    prompt: str,
    *,
    response_json: bool = False,
) -> str:
    if provider == "gemini":
        return await gemini_generate_text(model, prompt, response_json=response_json)
    if provider == "doubao":
        return await doubao_generate_text(model, prompt, response_json=response_json)
    raise AiProviderError(f"不支持的 AI provider: {provider}", error_code="UNSUPPORTED_PROVIDER")


async def _generate_image_with_provider(provider: str, model: str, prompt: str) -> str:
    if provider == "gemini":
        return await gemini_generate_image(model, prompt)
    if provider == "doubao":
        return await doubao_generate_image(model, prompt)
    raise AiProviderError(f"不支持的图片 AI provider: {provider}", error_code="UNSUPPORTED_PROVIDER")


async def _generate_audio_with_provider(provider: str, model: str, text: str, *, voice_ref: dict | None) -> str:
    if provider == "gemini":
        voice_name = _voice_name_from_ref(voice_ref) or settings.GEMINI_TTS_VOICE
        return await gemini_generate_audio(model, text, voice_name=voice_name)
    if provider == "doubao":
        voice_type = _voice_name_from_ref(voice_ref) or settings.DOUBAO_TTS_VOICE_TYPE
        return await doubao_generate_audio(text, voice_type=voice_type)
    raise AiProviderError(f"不支持的语音 AI provider: {provider}", error_code="UNSUPPORTED_PROVIDER")


async def _generate_lip_sync_with_provider(
    provider: str,
    model: str,
    *,
    audio_url: str,
    image_url: str,
    prompt: str | None,
) -> str:
    if provider in {"kling", "kling_avatar"}:
        return await kling_avatar_generate_lip_sync(
            model,
            image_url=image_url,
            audio_url=audio_url,
            prompt=prompt,
        )
    raise AiProviderError(f"不支持的对口型 AI provider: {provider}", error_code="UNSUPPORTED_PROVIDER")


def _voice_name_from_ref(voice_ref: dict | None) -> str | None:
    if not voice_ref:
        return None
    value = voice_ref.get("voice_name") or voice_ref.get("voice_type") or voice_ref.get("provider_voice_id")
    return str(value) if value else None


def _narration_text_for_page(page: dict) -> str:
    text = str(page.get("narration_text") or page.get("text_zh") or page.get("text_en") or "").strip()
    if not text:
        raise AiProviderError(f"第 {page.get('page_no') or page.get('id')} 页缺少朗读文本", error_code="AUDIO_TEXT_MISSING")
    return text


def _public_url_for_page(page: dict, *, key: str, error_code: str) -> str:
    value = _optional_public_url(page.get(key))
    if value:
        return value
    label = page.get("page_no") or page.get("id")
    raise AiProviderError(f"第 {label} 页缺少公网可访问的 {key}", error_code=error_code)


def _optional_public_url(value: object) -> str | None:
    url = str(value or "").strip()
    if url.startswith("http://") or url.startswith("https://"):
        return url
    return None


def _build_picture_book_image_prompt(page: dict, *, page_index: int, page_count: int) -> str:
    title = str(page.get("title") or f"第 {page_index + 1} 页")
    text = str(page.get("text_zh") or page.get("text_en") or page.get("narration_text") or "")
    visual_prompt = str(page.get("visual_prompt") or text or title)
    characters = page.get("character_appearances") or []
    dialogues = page.get("dialogues") or []
    return (
        "你是一名专业儿童绘本插画师。\n\n"
        f"请为第 {page_index + 1} 页 / 共 {page_count} 页生成一张儿童绘本内页插画。\n\n"
        f"页面标题：{title}\n"
        f"页面正文：{text}\n"
        f"画面描述：{visual_prompt}\n"
        f"出场形象：{characters}\n"
        f"对白标记：{dialogues}\n\n"
        "要求：\n"
        "- 画面温暖、有童趣、适合儿童阅读。\n"
        "- 保持绘本插画质感，构图完整，主体清晰。\n"
        "- 图片中不要出现任何文字、字母、标题、标签或边框。\n"
        "- 只画当前页，不要把其它页内容画进来。"
    )


def _build_avatar_prompt(page: dict) -> str:
    title = str(page.get("title") or "")
    visual_prompt = str(page.get("visual_prompt") or "")
    text = str(page.get("narration_text") or page.get("text_zh") or page.get("text_en") or "")
    return (
        "A warm children's picture book character speaks naturally to the audience. "
        "Keep the original illustration style and identity stable. "
        "Use gentle facial expressions, subtle head movement, and child-friendly performance. "
        f"Page title: {title}. Visual context: {visual_prompt}. Spoken content: {text[:240]}"
    )


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
    if provider in {"kling", "kling_avatar"}:
        if capability == AiProviderCapability.LIP_SYNC:
            return settings.KLING_AVATAR_MODEL
        raise AiProviderError(f"可灵 Avatar 不支持该能力: {capability}", error_code="UNSUPPORTED_PROVIDER")
    raise AiProviderError(f"不支持的 AI provider: {provider}", error_code="UNSUPPORTED_PROVIDER")


async def _record_provider_failure(
    db: AsyncSession,
    *,
    capability: AiProviderCapability,
    task_id: int | None,
    provider: str,
    model: str,
    started: float,
    request_payload: dict,
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


def _snapshot(payload: dict) -> dict:
    return {key: value for key, value in payload.items() if key not in {"api_key", "secret", "raw_body"}}
