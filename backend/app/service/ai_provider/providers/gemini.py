import base64
from io import BytesIO
from typing import Any
import wave

from app.core.config import settings
from app.service.ai_provider.errors import AiProviderError


async def gemini_generate_text(model: str, prompt: str, *, response_json: bool) -> str:
    if not settings.GEMINI_API_KEY:
        raise AiProviderError("GEMINI_API_KEY 未配置", error_code="GEMINI_API_KEY_MISSING")
    try:
        from google import genai
        from google.genai import types
    except ImportError as exc:
        raise AiProviderError("google-genai 未安装", error_code="GEMINI_SDK_MISSING") from exc

    kwargs: dict[str, Any] = {"api_key": settings.GEMINI_API_KEY}
    if settings.GEMINI_API_URL:
        kwargs["http_options"] = types.HttpOptions(base_url=settings.GEMINI_API_URL)
    client = genai.Client(**kwargs)
    config_kwargs: dict[str, Any] = {"response_modalities": ["TEXT"]}
    if response_json:
        config_kwargs["response_mime_type"] = "application/json"
    response = await client.aio.models.generate_content(
        model=model,
        contents=types.Content(parts=[types.Part(text=prompt)]),
        config=types.GenerateContentConfig(**config_kwargs),
    )
    text = getattr(response, "text", None)
    if text:
        return text.strip()
    if response.candidates and response.candidates[0].content:
        parts = response.candidates[0].content.parts or []
        for part in parts:
            if part.text:
                return part.text.strip()
    raise AiProviderError("Gemini 返回空文本", error_code="GEMINI_EMPTY_RESPONSE")


def _inline_data_to_data_url(inline_data: Any) -> str:
    data = inline_data.data
    if isinstance(data, bytes):
        base64_data = base64.b64encode(data).decode("ascii")
    else:
        base64_data = str(data)
    return f"data:{inline_data.mime_type};base64,{base64_data}"


def _finish_reason_error(finish_reason: Any) -> AiProviderError | None:
    if finish_reason is None:
        return None
    reason_name = getattr(finish_reason, "name", str(finish_reason))
    if reason_name == "STOP":
        return None
    policy_reasons = {"IMAGE_SAFETY", "PROHIBITED_CONTENT", "SAFETY", "RECITATION"}
    error_code = "PROVIDER_CONTENT_REJECTED" if reason_name in policy_reasons else "PROVIDER_FAILED"
    return AiProviderError(f"Gemini 图片生成非正常结束: {reason_name}", error_code=error_code)


async def gemini_generate_image(model: str, prompt: str) -> str:
    if not settings.GEMINI_API_KEY:
        raise AiProviderError("GEMINI_API_KEY 未配置", error_code="GEMINI_API_KEY_MISSING")
    try:
        from google import genai
        from google.genai import types
    except ImportError as exc:
        raise AiProviderError("google-genai 未安装", error_code="GEMINI_SDK_MISSING") from exc

    kwargs: dict[str, Any] = {"api_key": settings.GEMINI_API_KEY}
    if settings.GEMINI_API_URL:
        kwargs["http_options"] = types.HttpOptions(base_url=settings.GEMINI_API_URL)
    client = genai.Client(**kwargs)
    response = await client.aio.models.generate_content(
        model=model,
        contents=types.Content(parts=[types.Part(text=prompt)]),
        config=types.GenerateContentConfig(response_modalities=["TEXT", "IMAGE"]),
    )
    if not response.candidates:
        raise AiProviderError("Gemini 图片生成未返回候选内容", error_code="GEMINI_EMPTY_RESPONSE")
    for candidate in response.candidates:
        finish_error = _finish_reason_error(candidate.finish_reason)
        if finish_error is not None:
            raise finish_error
        if not candidate.content:
            continue
        for part in candidate.content.parts or []:
            if part.inline_data and part.inline_data.mime_type and part.inline_data.mime_type.startswith("image/"):
                return _inline_data_to_data_url(part.inline_data)
    raise AiProviderError("Gemini 图片生成未返回图片", error_code="GEMINI_NO_IMAGE")


def _pcm_to_wav_data_url(pcm: bytes, *, channels: int = 1, rate: int = 24000, sample_width: int = 2) -> str:
    buffer = BytesIO()
    with wave.open(buffer, "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(sample_width)
        wf.setframerate(rate)
        wf.writeframes(pcm)
    base64_data = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:audio/wav;base64,{base64_data}"


async def gemini_generate_audio(model: str, text: str, *, voice_name: str | None = None) -> str:
    if not settings.GEMINI_API_KEY:
        raise AiProviderError("GEMINI_API_KEY 未配置", error_code="GEMINI_API_KEY_MISSING")
    try:
        from google import genai
        from google.genai import types
    except ImportError as exc:
        raise AiProviderError("google-genai 未安装", error_code="GEMINI_SDK_MISSING") from exc

    kwargs: dict[str, Any] = {"api_key": settings.GEMINI_API_KEY}
    if settings.GEMINI_API_URL:
        kwargs["http_options"] = types.HttpOptions(base_url=settings.GEMINI_API_URL)
    client = genai.Client(**kwargs)
    response = await client.aio.models.generate_content(
        model=model,
        contents=text,
        config=types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name=voice_name or settings.GEMINI_TTS_VOICE,
                    )
                )
            ),
        ),
    )
    if not response.candidates:
        raise AiProviderError("Gemini 语音生成未返回候选内容", error_code="GEMINI_EMPTY_RESPONSE")
    for candidate in response.candidates:
        finish_error = _finish_reason_error(candidate.finish_reason)
        if finish_error is not None:
            raise finish_error
        if not candidate.content:
            continue
        for part in candidate.content.parts or []:
            inline_data = getattr(part, "inline_data", None)
            if inline_data and inline_data.data:
                data = inline_data.data
                pcm = data if isinstance(data, bytes) else base64.b64decode(str(data))
                return _pcm_to_wav_data_url(pcm)
    raise AiProviderError("Gemini 语音生成未返回音频", error_code="GEMINI_NO_AUDIO")
