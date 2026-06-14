import asyncio
import base64
import hashlib
import hmac
import json
import time
from typing import Any
from urllib import error as urllib_error
from urllib import request as urllib_request

from app.core.config import settings
from app.schema.ai_provider import AudioGenerationRequest, LipSyncGenerationRequest, VoicePromptRef
from app.service.ai_provider.errors import AiProviderError


async def kling_generate_audio(
    request: AudioGenerationRequest | str,
    *,
    voice_id: str | None = None,
    voice_language: str | None = None,
    voice_speed: float | None = None,
) -> str:
    text = request.text if isinstance(request, AudioGenerationRequest) else request
    text = text.strip()
    if not text:
        raise AiProviderError("可灵 TTS 需要待合成文本", error_code="KLING_TTS_TEXT_MISSING")
    if len(text) > 1000:
        raise AiProviderError("可灵 TTS 文本长度不能超过 1000", error_code="KLING_TTS_TEXT_TOO_LONG")

    voice_ref = request.voice_ref if isinstance(request, AudioGenerationRequest) else None
    resolved_voice_id, parsed_language = _voice_config_from_ref(voice_ref)
    resolved_voice_id = (voice_id or resolved_voice_id or "").strip()
    if not resolved_voice_id:
        raise AiProviderError("可灵 TTS 音色未选择，请为系统声音配置 voice_style_code", error_code="KLING_TTS_VOICE_MISSING")

    resolved_language = _validate_voice_language(
        voice_language or parsed_language or _kling_tts_voice_language_default(resolved_voice_id)
    )
    resolved_speed = _validate_voice_speed(voice_speed if voice_speed is not None else settings.KLING_TTS_VOICE_SPEED)
    body: dict[str, Any] = {
        "text": text,
        "voice_id": resolved_voice_id,
        "voice_language": resolved_language,
        "voice_speed": resolved_speed,
    }

    payload = await asyncio.get_running_loop().run_in_executor(None, _submit_tts_task, body)
    audio_url = _audio_url_from_payload(payload)
    if audio_url:
        return audio_url
    task_id = payload.get("task_id")
    if not task_id:
        raise AiProviderError("可灵 TTS 任务提交未返回 task_id", error_code="KLING_TTS_SUBMIT_FAILED")
    return await _poll_tts_task(str(task_id))


async def kling_generate_lip_sync(
    mode: str,
    *,
    request: LipSyncGenerationRequest | None = None,
    image_url: str | None = None,
    audio_url: str | None = None,
    prompt: str | None = None,
) -> str:
    resolved_mode = _validate_avatar_mode(mode)

    resolved_image_url = request.image_url if request else image_url
    resolved_audio_url = request.audio_url if request else audio_url
    if not resolved_image_url or not resolved_audio_url:
        raise AiProviderError("可灵 Avatar 2.0 需要 image_url 和 audio_url", error_code="KLING_AVATAR_INPUT_MISSING")

    body: dict[str, Any] = {
        "image": resolved_image_url,
        "sound_file": resolved_audio_url,
        "mode": resolved_mode,
    }
    resolved_prompt = (_build_kling_avatar_prompt(request) if request else prompt or settings.KLING_AVATAR_PROMPT or "").strip()
    if resolved_prompt:
        body["prompt"] = resolved_prompt[:2500]
    if settings.KLING_AVATAR_CALLBACK_URL:
        body["callback_url"] = settings.KLING_AVATAR_CALLBACK_URL

    task_id = await asyncio.get_running_loop().run_in_executor(None, _submit_avatar_task, body)
    return await _poll_avatar_task(task_id)


def _voice_config_from_ref(voice_ref: VoicePromptRef | None) -> tuple[str | None, str | None]:
    if not voice_ref:
        return None, None
    if voice_ref.provider_voice_id and voice_ref.voice_language:
        return str(voice_ref.provider_voice_id), str(voice_ref.voice_language)
    for value in (voice_ref.provider_voice_id, voice_ref.voice_type, voice_ref.voice_name):
        voice_id, language = _parse_voice_config(value)
        if voice_id:
            return voice_id, language
    return None, None


def _parse_voice_config(value: str | None) -> tuple[str | None, str | None]:
    raw_value = str(value or "").strip()
    if not raw_value:
        return None, None
    parts = [part.strip() for part in raw_value.split("#") if part.strip()]
    if len(parts) >= 3 and parts[-1] in {"zh", "en"}:
        return parts[-2], parts[-1]
    if len(parts) == 2 and parts[-1] in {"zh", "en"}:
        return parts[0], parts[1]
    return raw_value, None


def _kling_tts_voice_language_default(voice_id: str) -> str:
    if voice_id.startswith("oversea_"):
        return "en"
    return settings.KLING_TTS_VOICE_LANGUAGE


def _validate_voice_language(value: str) -> str:
    normalized = value.strip().lower()
    if normalized not in {"zh", "en"}:
        raise AiProviderError("可灵 TTS voice_language 仅支持 zh/en", error_code="KLING_TTS_LANGUAGE_UNSUPPORTED")
    return normalized


def _validate_voice_speed(value: float) -> float:
    rounded = round(float(value), 1)
    if rounded < 0.8 or rounded > 2.0:
        raise AiProviderError("可灵 TTS voice_speed 有效范围为 0.8~2.0", error_code="KLING_TTS_SPEED_UNSUPPORTED")
    return rounded


def _submit_tts_task(body: dict[str, Any]) -> dict[str, Any]:
    data = _request_json(settings.KLING_TTS_SUBMIT_PATH, method="POST", body=body)
    _raise_for_kling_error(data, "可灵 TTS 任务提交失败")
    payload = data.get("data") or {}
    if not isinstance(payload, dict):
        raise AiProviderError("可灵 TTS 任务提交返回结构异常", error_code="KLING_TTS_SUBMIT_FAILED")
    return payload


async def _poll_tts_task(task_id: str) -> str:
    deadline = asyncio.get_running_loop().time() + settings.KLING_TTS_TIMEOUT_SECONDS
    status_path = settings.KLING_TTS_STATUS_PATH.format(task_id=task_id)
    while True:
        data = await asyncio.get_running_loop().run_in_executor(None, _request_json, status_path, "GET", None)
        _raise_for_kling_error(data, "可灵 TTS 任务查询失败")
        payload = data.get("data") or {}
        task_status = str(payload.get("task_status") or "").lower()
        if task_status == "succeed":
            audio_url = _audio_url_from_payload(payload)
            if not audio_url:
                raise AiProviderError("可灵 TTS 任务成功但未返回音频 URL", error_code="KLING_TTS_EMPTY_AUDIO")
            return audio_url
        if task_status == "failed":
            raise AiProviderError(str(payload.get("task_status_msg") or "可灵 TTS 任务失败"), error_code="KLING_TTS_FAILED")
        if asyncio.get_running_loop().time() >= deadline:
            raise AiProviderError("可灵 TTS 任务超时", error_code="KLING_TTS_TIMEOUT")
        await asyncio.sleep(settings.KLING_TTS_POLL_INTERVAL_SECONDS)


def _audio_url_from_payload(payload: dict[str, Any]) -> str | None:
    return _audio_url_from_task_result(payload.get("task_result") or {})


def _audio_url_from_task_result(task_result: dict[str, Any]) -> str | None:
    audios = task_result.get("audios") or []
    for item in audios:
        if isinstance(item, dict) and item.get("url"):
            return str(item["url"])
    return None


def _build_kling_avatar_prompt(request: LipSyncGenerationRequest | None) -> str:
    if request is None:
        return settings.KLING_AVATAR_PROMPT or ""
    page = request.page
    title = str(page.title or "")
    visual_prompt = str(page.visual_prompt or "")
    text = str(page.text_zh or page.text_en or "")
    prompt = (
        "A warm children's picture book character speaks naturally to the audience. "
        "Keep the original illustration style and character identity stable. "
        "Use gentle facial expressions, subtle head movement, and child-friendly performance. "
        f"Page title: {title}. Visual context: {visual_prompt}. Spoken content: {text[:240]}"
    )
    fallback = (settings.KLING_AVATAR_PROMPT or "").strip()
    return f"{fallback} {prompt}".strip() if fallback else prompt


def _submit_avatar_task(body: dict[str, Any]) -> str:
    data = _request_json(settings.KLING_AVATAR_SUBMIT_PATH, method="POST", body=body)
    _raise_for_kling_error(data, "可灵 Avatar 任务提交失败")
    payload = data.get("data") or {}
    task_id = payload.get("task_id")
    if not task_id:
        raise AiProviderError("可灵 Avatar 2.0 任务提交未返回 task_id", error_code="KLING_AVATAR_SUBMIT_FAILED")
    return str(task_id)


async def _poll_avatar_task(task_id: str) -> str:
    deadline = asyncio.get_running_loop().time() + settings.KLING_AVATAR_TIMEOUT_SECONDS
    status_path = settings.KLING_AVATAR_STATUS_PATH.format(task_id=task_id)
    while True:
        data = await asyncio.get_running_loop().run_in_executor(None, _request_json, status_path, "GET", None)
        _raise_for_kling_error(data, "可灵 Avatar 任务查询失败")
        payload = data.get("data") or {}
        task_status = str(payload.get("task_status") or "").lower()
        if task_status == "succeed":
            video_url = _video_url_from_task_result(payload.get("task_result") or {})
            if not video_url:
                raise AiProviderError("可灵 Avatar 任务成功但未返回视频 URL", error_code="KLING_AVATAR_EMPTY_VIDEO")
            return video_url
        if task_status == "failed":
            raise AiProviderError(str(payload.get("task_status_msg") or "可灵 Avatar 任务失败"), error_code="KLING_AVATAR_FAILED")
        if asyncio.get_running_loop().time() >= deadline:
            raise AiProviderError("可灵 Avatar 任务超时", error_code="KLING_AVATAR_TIMEOUT")
        await asyncio.sleep(settings.KLING_AVATAR_POLL_INTERVAL_SECONDS)


def _validate_avatar_mode(mode: str) -> str:
    normalized = mode.strip().lower()
    if normalized not in {"std", "pro"}:
        raise AiProviderError("可灵 Avatar 仅支持 std/pro 模式", error_code="KLING_AVATAR_MODE_UNSUPPORTED")
    return normalized


def _video_url_from_task_result(task_result: dict[str, Any]) -> str | None:
    videos = task_result.get("videos") or []
    for item in videos:
        if isinstance(item, dict) and item.get("url"):
            return str(item["url"])
    return None


def _request_json(path: str, method: str = "GET", body: dict[str, Any] | None = None) -> dict[str, Any]:
    url = _absolute_url(path)
    payload = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    request = urllib_request.Request(
        url,
        data=payload,
        headers={
            "Authorization": _authorization_header(),
            "Content-Type": "application/json",
        },
        method=method,
    )
    try:
        with urllib_request.urlopen(request, timeout=60) as response:
            response_body = response.read()
    except urllib_error.HTTPError as exc:
        response_body = exc.read()
        message = _error_message_from_response_body(response_body) or str(exc)
        raise AiProviderError(message, error_code=f"KLING_HTTP_{exc.code}") from exc
    except urllib_error.URLError as exc:
        raise AiProviderError(str(exc.reason or exc), error_code="KLING_REQUEST_FAILED") from exc
    try:
        return json.loads(response_body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise AiProviderError("可灵返回非 JSON 响应", error_code="KLING_INVALID_JSON") from exc


def _absolute_url(path: str) -> str:
    if path.startswith("http://") or path.startswith("https://"):
        return path
    base_url = settings.KLING_BASE_URL or settings.KLING_AVATAR_BASE_URL or "https://api-beijing.klingai.com"
    return f"{base_url.rstrip('/')}/{path.lstrip('/')}"


def _raise_for_kling_error(data: dict[str, Any], fallback_message: str) -> None:
    code = data.get("code")
    if code in {0, "0"}:
        return
    raise AiProviderError(str(data.get("message") or fallback_message), error_code=f"KLING_{code}")


def _authorization_header() -> str:
    access_key = str(settings.KLING_ACCESS_KEY or settings.KLING_AVATAR_ACCESS_KEY or "").strip()
    secret_key = str(settings.KLING_SECRET_KEY or settings.KLING_AVATAR_SECRET_KEY or "").strip()
    if not access_key or not secret_key:
        raise AiProviderError(
            "KLING_ACCESS_KEY/KLING_SECRET_KEY 未配置",
            error_code="KLING_AUTH_MISSING",
        )
    return f"Bearer {_encode_kling_jwt(access_key, secret_key)}"


def _encode_kling_jwt(access_key: str, secret_key: str) -> str:
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "iss": access_key,
        "exp": now + 1800,
        "nbf": now - 5,
    }
    signing_input = ".".join(
        (
            _base64url_json(header),
            _base64url_json(payload),
        )
    )
    signature = hmac.new(secret_key.encode("utf-8"), signing_input.encode("utf-8"), hashlib.sha256).digest()
    return f"{signing_input}.{_base64url(signature)}"


def _base64url_json(value: dict[str, Any]) -> str:
    return _base64url(json.dumps(value, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))


def _base64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _error_message_from_response_body(response_body: bytes) -> str | None:
    try:
        data = json.loads(response_body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None
    if isinstance(data, dict):
        return str(data.get("message") or "") or None
    return None
