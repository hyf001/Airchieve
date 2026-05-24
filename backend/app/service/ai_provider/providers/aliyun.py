import asyncio
import base64
import html
from io import BytesIO
from typing import Any

from app.core.config import settings
from app.service.ai_provider.errors import AiProviderError


def _audio_mime_type(audio_format: str) -> str:
    normalized = audio_format.strip().lower()
    if normalized == "wav":
        return "audio/wav"
    if normalized == "mp3":
        return "audio/mpeg"
    if normalized == "pcm":
        return "audio/L16"
    return f"audio/{normalized or 'wav'}"


async def aliyun_generate_audio(text: str, *, voice: str, emotion_type: str | None = None) -> str:
    if not settings.ALIYUN_TTS_APP_KEY:
        raise AiProviderError("ALIYUN_TTS_APP_KEY 未配置", error_code="ALIYUN_TTS_APP_KEY_MISSING")
    resolved_voice = voice.strip()
    if not resolved_voice:
        raise AiProviderError("阿里云 TTS 音色未选择，请为系统声音配置 voice_style_code", error_code="ALIYUN_TTS_VOICE_MISSING")

    return await asyncio.get_running_loop().run_in_executor(None, _synthesize_sync, text, resolved_voice, emotion_type)


def _synthesize_sync(text: str, voice: str, emotion_type: str | None) -> str:
    try:
        import nls
    except ImportError as exc:
        raise AiProviderError("alibabacloud-nls-python-sdk 未安装", error_code="ALIYUN_TTS_SDK_MISSING") from exc

    token = _resolve_token(nls)
    audio_buffer = BytesIO()
    failed: list[AiProviderError] = []

    def _on_data(data: bytes, *_args: Any) -> None:
        audio_buffer.write(data)

    def _on_completed(message: str, *_args: Any) -> None:
        return None

    def _on_error(message: str, *_args: Any) -> None:
        failed.append(AiProviderError(str(message or "阿里云 TTS 生成失败"), error_code="ALIYUN_TTS_FAILED"))

    def _on_close(*_args: Any) -> None:
        return None

    synthesis_text, extra_payload = _prepare_synthesis_text(text, emotion_type)
    synthesizer = nls.NlsSpeechSynthesizer(
        url=settings.ALIYUN_TTS_URL,
        token=token,
        appkey=settings.ALIYUN_TTS_APP_KEY,
        long_tts=settings.ALIYUN_TTS_LONG_TEXT,
        on_data=_on_data,
        on_completed=_on_completed,
        on_error=_on_error,
        on_close=_on_close,
    )

    try:
        started = synthesizer.start(
            synthesis_text,
            voice=voice,
            aformat=settings.ALIYUN_TTS_FORMAT,
            sample_rate=settings.ALIYUN_TTS_SAMPLE_RATE,
            volume=settings.ALIYUN_TTS_VOLUME,
            speech_rate=settings.ALIYUN_TTS_SPEECH_RATE,
            pitch_rate=settings.ALIYUN_TTS_PITCH_RATE,
            wait_complete=True,
            start_timeout=settings.ALIYUN_TTS_START_TIMEOUT_SECONDS,
            completed_timeout=settings.ALIYUN_TTS_COMPLETED_TIMEOUT_SECONDS,
            ex=extra_payload,
        )
        if started is False:
            raise AiProviderError("阿里云 TTS 启动失败", error_code="ALIYUN_TTS_START_FAILED")
    except AiProviderError:
        raise
    except Exception as exc:
        raise AiProviderError(str(exc) or "阿里云 TTS 调用失败", error_code="ALIYUN_TTS_REQUEST_FAILED") from exc

    if failed:
        raise failed[0]
    audio_bytes = audio_buffer.getvalue()
    if not audio_bytes:
        raise AiProviderError("阿里云 TTS 返回空音频", error_code="ALIYUN_TTS_EMPTY_AUDIO")

    base64_data = base64.b64encode(audio_bytes).decode("ascii")
    return f"data:{_audio_mime_type(settings.ALIYUN_TTS_FORMAT)};base64,{base64_data}"


def _prepare_synthesis_text(text: str, emotion_type: str | None) -> tuple[str, dict[str, Any] | None]:
    resolved_emotion = (emotion_type or "").strip()
    if not resolved_emotion:
        return text, None
    escaped_text = html.escape(text, quote=False)
    escaped_emotion = html.escape(resolved_emotion, quote=True)
    ssml_text = f'<speak><emotion category="{escaped_emotion}" intensity="1.0">{escaped_text}</emotion></speak>'
    return ssml_text, {"enable_ssml": True}


def _resolve_token(nls_module: Any) -> str:
    if settings.ALIYUN_TTS_TOKEN:
        return settings.ALIYUN_TTS_TOKEN
    if not settings.ALIYUN_TTS_ACCESS_KEY_ID or not settings.ALIYUN_TTS_ACCESS_KEY_SECRET:
        raise AiProviderError(
            "ALIYUN_TTS_TOKEN 未配置，且 ALIYUN_TTS_ACCESS_KEY_ID / ALIYUN_TTS_ACCESS_KEY_SECRET 缺失",
            error_code="ALIYUN_TTS_TOKEN_MISSING",
        )
    try:
        return nls_module.token.getToken(
            settings.ALIYUN_TTS_ACCESS_KEY_ID,
            settings.ALIYUN_TTS_ACCESS_KEY_SECRET,
            domain=settings.ALIYUN_TTS_TOKEN_DOMAIN,
            url=settings.ALIYUN_TTS_TOKEN_URL,
        )
    except Exception as exc:
        raise AiProviderError(str(exc) or "阿里云 TTS Token 获取失败", error_code="ALIYUN_TTS_TOKEN_REQUEST_FAILED") from exc
