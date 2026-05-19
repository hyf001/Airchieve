from datetime import datetime, timezone
from time import perf_counter

from sqlalchemy.ext.asyncio import AsyncSession

from app.model.ai_provider import (
    AiProviderCall,
    AiProviderCallStatus,
    AiProviderCapability,
    AiProviderUsageRecord,
    AiProviderUsageType,
)


DEFAULT_PROVIDER = "local_mock"
DEFAULT_MODEL = "airchieve-mvp-adapter"


async def record_provider_call(
    db: AsyncSession,
    *,
    capability: AiProviderCapability,
    task_id: int | None,
    request_payload: dict,
    response_payload: dict,
    provider: str = DEFAULT_PROVIDER,
    model: str = DEFAULT_MODEL,
    status: AiProviderCallStatus = AiProviderCallStatus.SUCCEEDED,
    latency_ms: int | None = None,
) -> AiProviderCall:
    call = AiProviderCall(
        task_id=task_id,
        provider=provider,
        model=model,
        capability=capability,
        request_payload_snapshot=_snapshot(request_payload),
        response_payload_snapshot=_snapshot(response_payload),
        status=status,
        latency_ms=latency_ms,
    )
    db.add(call)
    await db.flush()
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
    started = perf_counter()
    title = prompt.strip()[:40] or "奇妙的一天"
    result = f"{title}：一个关于勇气、好奇心和分享的温暖儿童故事。"
    await record_provider_call(
        db,
        capability=AiProviderCapability.TEXT,
        task_id=task_id,
        request_payload={"prompt_preview": prompt[:120]},
        response_payload={"text_preview": result[:120]},
        latency_ms=round((perf_counter() - started) * 1000),
    )
    return result


async def generate_structured(db: AsyncSession, *, task_id: int | None, request: dict) -> dict:
    started = perf_counter()
    page_count = int(request.get("target_page_count") or 8)
    title = request.get("title") or "专属绘本"
    pages = [
        {
            "page_no": page_no,
            "title": f"{title} 第 {page_no} 页",
            "text_zh": f"第 {page_no} 页，主角继续向前探索，发现新的朋友和小小的勇气。",
            "text_en": None,
            "narration_text": f"第 {page_no} 页，主角继续向前探索，发现新的朋友和小小的勇气。",
            "visual_prompt": f"儿童绘本插图，第 {page_no} 页，温暖明亮，主角在童话场景中探索。",
            "character_appearances": [{"role_code": "hero", "display_name": "主角"}],
            "dialogues": [],
        }
        for page_no in range(1, page_count + 1)
    ]
    response = {"pages": pages}
    await record_provider_call(
        db,
        capability=AiProviderCapability.STRUCTURED,
        task_id=task_id,
        request_payload={"target_page_count": page_count, "title": title},
        response_payload={"page_count": len(pages)},
        latency_ms=round((perf_counter() - started) * 1000),
    )
    return response


async def generate_image(db: AsyncSession, *, task_id: int | None, page_ids: list[int] | None) -> dict:
    response = {"page_ids": page_ids or [], "asset_refs": []}
    await record_provider_call(
        db,
        capability=AiProviderCapability.IMAGE,
        task_id=task_id,
        request_payload={"page_ids": page_ids or []},
        response_payload=response,
    )
    return response


async def generate_audio(db: AsyncSession, *, task_id: int | None, page_ids: list[int] | None) -> dict:
    response = {"page_ids": page_ids or [], "asset_refs": []}
    await record_provider_call(
        db,
        capability=AiProviderCapability.AUDIO,
        task_id=task_id,
        request_payload={"page_ids": page_ids or []},
        response_payload=response,
    )
    return response


def _snapshot(payload: dict) -> dict:
    return {key: value for key, value in payload.items() if key not in {"api_key", "secret", "raw_body"}}
