import asyncio
import json
from typing import Any
from urllib import request as urllib_request

from app.core.config import settings
from app.service.ai_provider.errors import AiProviderError


async def kling_avatar_generate_lip_sync(
    model: str,
    *,
    image_url: str,
    audio_url: str,
    prompt: str | None = None,
) -> str:
    if not settings.KLING_AVATAR_API_KEY:
        raise AiProviderError("KLING_AVATAR_API_KEY 未配置", error_code="KLING_AVATAR_API_KEY_MISSING")
    if model not in {"kling-avatar-2.0/standard", "kling-avatar-2.0/pro"}:
        raise AiProviderError("可灵 Avatar 2.0 仅支持 standard/pro 模型", error_code="KLING_AVATAR_MODEL_UNSUPPORTED")

    body: dict[str, Any] = {
        "model": model,
        "input": {
            "image_urls": [image_url],
            "audio_url": audio_url,
        },
    }
    resolved_prompt = (prompt or settings.KLING_AVATAR_PROMPT or "").strip()
    if resolved_prompt:
        body["input"]["prompt"] = resolved_prompt
    if settings.KLING_AVATAR_CALLBACK_URL:
        body["callback_url"] = settings.KLING_AVATAR_CALLBACK_URL

    task_id = await asyncio.get_running_loop().run_in_executor(None, _submit_avatar_task, body)
    return await _poll_avatar_task(task_id)


def _submit_avatar_task(body: dict[str, Any]) -> str:
    data = _request_json(settings.KLING_AVATAR_SUBMIT_PATH, method="POST", body=body)
    if data.get("code") not in {200, "200", None}:
        raise AiProviderError(str(data.get("message") or "可灵 Avatar 2.0 任务提交失败"), error_code=f"KLING_AVATAR_{data.get('code')}")
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
        if data.get("code") not in {200, "200", None}:
            raise AiProviderError(str(data.get("message") or "可灵 Avatar 2.0 查询失败"), error_code=f"KLING_AVATAR_{data.get('code')}")
        payload = data.get("data") or {}
        task_status = str(payload.get("status") or "").lower()
        if task_status == "finished":
            video_url = _video_url_from_files(payload.get("files") or [])
            if not video_url:
                raise AiProviderError("可灵 Avatar 2.0 任务成功但未返回视频 URL", error_code="KLING_AVATAR_EMPTY_VIDEO")
            return video_url
        if task_status == "failed":
            raise AiProviderError(str(payload.get("error_message") or "可灵 Avatar 2.0 任务失败"), error_code="KLING_AVATAR_FAILED")
        if asyncio.get_running_loop().time() >= deadline:
            raise AiProviderError("可灵 Avatar 2.0 任务超时", error_code="KLING_AVATAR_TIMEOUT")
        await asyncio.sleep(settings.KLING_AVATAR_POLL_INTERVAL_SECONDS)


def _video_url_from_files(files: list[dict[str, Any]]) -> str | None:
    for item in files:
        if item.get("file_type") == "video" and item.get("file_url"):
            return str(item["file_url"])
    for item in files:
        if item.get("format") == "mp4" and item.get("file_url"):
            return str(item["file_url"])
    return None


def _request_json(path: str, method: str = "GET", body: dict[str, Any] | None = None) -> dict[str, Any]:
    url = _absolute_url(path)
    payload = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    request = urllib_request.Request(
        url,
        data=payload,
        headers={
            "Authorization": f"Bearer {settings.KLING_AVATAR_API_KEY}",
            "Content-Type": "application/json",
        },
        method=method,
    )
    with urllib_request.urlopen(request, timeout=60) as response:
        response_body = response.read()
    return json.loads(response_body.decode("utf-8"))


def _absolute_url(path: str) -> str:
    if path.startswith("http://") or path.startswith("https://"):
        return path
    return f"{settings.KLING_AVATAR_BASE_URL.rstrip('/')}/{path.lstrip('/')}"
