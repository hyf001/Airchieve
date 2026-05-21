import asyncio
import base64
import json
from typing import Any
from urllib import request as urllib_request
from uuid import uuid4

from app.core.config import settings
from app.service.ai_provider.errors import AiProviderError


async def doubao_generate_text(model: str, prompt: str, *, response_json: bool) -> str:
    if not settings.DOUBAO_API_KEY:
        raise AiProviderError("DOUBAO_API_KEY 未配置", error_code="DOUBAO_API_KEY_MISSING")
    if not model:
        raise AiProviderError("DOUBAO_TEXT_MODEL 未配置", error_code="DOUBAO_MODEL_MISSING")
    try:
        from volcenginesdkarkruntime import Ark
    except ImportError as exc:
        raise AiProviderError("volcenginesdkarkruntime 未安装", error_code="DOUBAO_SDK_MISSING") from exc

    def _call() -> str:
        client = Ark(base_url=settings.DOUBAO_BASE_URL, api_key=settings.DOUBAO_API_KEY)
        kwargs: dict[str, Any] = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
        }
        if response_json:
            kwargs["response_format"] = {"type": "json_object"}
        response = client.chat.completions.create(**kwargs)
        if not response.choices:
            raise AiProviderError("豆包返回空 choices", error_code="DOUBAO_EMPTY_CHOICES")
        return response.choices[0].message.content or ""

    text = await asyncio.get_running_loop().run_in_executor(None, _call)
    if not text.strip():
        raise AiProviderError("豆包返回空文本", error_code="DOUBAO_EMPTY_RESPONSE")
    return text.strip()


async def doubao_generate_image(model: str, prompt: str, *, response_format: str = "b64_json") -> str:
    if not settings.DOUBAO_API_KEY:
        raise AiProviderError("DOUBAO_API_KEY 未配置", error_code="DOUBAO_API_KEY_MISSING")
    if not model:
        raise AiProviderError("DOUBAO_IMAGE_MODEL 未配置", error_code="DOUBAO_IMAGE_MODEL_MISSING")
    try:
        from volcenginesdkarkruntime import Ark
    except ImportError as exc:
        raise AiProviderError("volcenginesdkarkruntime 未安装", error_code="DOUBAO_SDK_MISSING") from exc

    def _call() -> str:
        client = Ark(base_url=settings.DOUBAO_BASE_URL, api_key=settings.DOUBAO_API_KEY)
        kwargs: dict[str, Any] = {
            "model": model,
            "prompt": prompt,
            "sequential_image_generation": "disabled",
            "size": "2304x1728",
            "watermark": False,
        }
        if response_format == "b64_json":
            kwargs["response_format"] = "b64_json"
        response = client.images.generate(**kwargs)
        if not response.data:
            raise AiProviderError("豆包图片生成返回空 data", error_code="DOUBAO_EMPTY_IMAGE")
        item = response.data[0]
        if response_format == "b64_json":
            b64_json = getattr(item, "b64_json", None)
            if not b64_json:
                raise AiProviderError("豆包图片生成未返回 b64_json", error_code="DOUBAO_EMPTY_IMAGE")
            return f"data:image/png;base64,{b64_json}"
        url = getattr(item, "url", None)
        if not url:
            raise AiProviderError("豆包图片生成未返回 URL", error_code="DOUBAO_EMPTY_IMAGE")
        return url

    return await asyncio.get_running_loop().run_in_executor(None, _call)


async def doubao_generate_audio(text: str, *, voice_type: str | None = None) -> str:
    missing = [
        key
        for key, value in {
            "DOUBAO_TTS_APP_ID": settings.DOUBAO_TTS_APP_ID,
            "DOUBAO_TTS_ACCESS_TOKEN": settings.DOUBAO_TTS_ACCESS_TOKEN,
            "DOUBAO_TTS_CLUSTER": settings.DOUBAO_TTS_CLUSTER,
        }.items()
        if not value
    ]
    if missing:
        raise AiProviderError(f"豆包 TTS 配置缺失：{', '.join(missing)}", error_code="DOUBAO_TTS_CONFIG_MISSING")
    resolved_voice_type = voice_type or settings.DOUBAO_TTS_VOICE_TYPE
    if not resolved_voice_type:
        raise AiProviderError("DOUBAO_TTS_VOICE_TYPE 未配置", error_code="DOUBAO_TTS_VOICE_MISSING")

    body = {
        "app": {
            "appid": settings.DOUBAO_TTS_APP_ID,
            "token": settings.DOUBAO_TTS_ACCESS_TOKEN,
            "cluster": settings.DOUBAO_TTS_CLUSTER,
        },
        "user": {"uid": "airchieve"},
        "audio": {
            "voice_type": resolved_voice_type,
            "encoding": "wav",
        },
        "request": {
            "reqid": uuid4().hex,
            "text": text,
            "operation": "query",
        },
    }

    def _call() -> str:
        payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
        request = urllib_request.Request(
            settings.DOUBAO_TTS_API_URL,
            data=payload,
            headers={
                "Authorization": f"Bearer;{settings.DOUBAO_TTS_ACCESS_TOKEN}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        with urllib_request.urlopen(request, timeout=60) as response:
            response_body = response.read()
        data = json.loads(response_body.decode("utf-8"))
        if data.get("code") not in {0, "0", None}:
            raise AiProviderError(
                str(data.get("message") or data.get("Message") or "豆包 TTS 生成失败"),
                error_code=f"DOUBAO_TTS_{data.get('code')}",
            )
        audio_base64 = data.get("data")
        if not audio_base64:
            raise AiProviderError("豆包 TTS 返回空音频", error_code="DOUBAO_TTS_EMPTY_AUDIO")
        # Validate that the service returned decodable base64 before exposing the data URL.
        base64.b64decode(audio_base64)
        return f"data:audio/wav;base64,{audio_base64}"

    return await asyncio.get_running_loop().run_in_executor(None, _call)
