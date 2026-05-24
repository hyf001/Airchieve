import json
import re
from typing import Any

from pydantic import BaseModel, Field, ValidationError

from app.service.ai_provider.errors import AiProviderError


class _StoryResponse(BaseModel):
    title: str = ""
    summary: str = ""
    content: str = ""


class _StoryboardPageResponse(BaseModel):
    page_no: int | None = None
    title: str | None = None
    text_zh: str = ""
    text_en: str | None = None
    narration_text: str | None = None
    visual_prompt: str = ""
    character_appearances: list[dict[str, Any]] = Field(default_factory=list)
    dialogues: list[dict[str, Any]] = Field(default_factory=list)


class _StoryboardResponse(BaseModel):
    pages: list[_StoryboardPageResponse]


def story_text_from_response(raw_text: str, *, fallback_title: str) -> str:
    try:
        data = parse_json_response(raw_text)
        if isinstance(data, dict):
            story = _StoryResponse.model_validate(data)
            if story.content:
                title = story.title.strip() or fallback_title or "专属故事"
                return f"{title}\n\n{story.content.strip()}"
    except (ValueError, ValidationError, json.JSONDecodeError):
        pass
    return raw_text.strip()


def story_from_response(raw_text: str, *, fallback_title: str, fallback_summary: str) -> dict[str, str]:
    try:
        data = parse_json_response(raw_text)
        if isinstance(data, dict):
            story = _StoryResponse.model_validate(data)
            content = story.content.strip()
            if content:
                return {
                    "title": (story.title.strip() or fallback_title or "专属故事")[:160],
                    "summary": (story.summary.strip() or fallback_summary or content[:80])[:1000],
                    "body": content[:3000],
                }
    except (ValueError, ValidationError, json.JSONDecodeError):
        pass
    content = raw_text.strip()
    return {
        "title": (fallback_title or "专属故事")[:160],
        "summary": (fallback_summary or content[:80])[:1000],
        "body": content[:3000],
    }


def storyboard_from_response(raw_text: str, *, title: str, page_count: int) -> dict:
    data = parse_json_response(raw_text)
    if isinstance(data, list):
        data = {"pages": data}
    if not isinstance(data, dict):
        raise AiProviderError("分镜响应不是 JSON 对象", error_code="STRUCTURED_INVALID_JSON")
    try:
        parsed = _StoryboardResponse.model_validate(data)
    except ValidationError as exc:
        raise AiProviderError("分镜响应结构不符合约定", error_code="STRUCTURED_SCHEMA_ERROR") from exc
    pages = []
    for index, item in enumerate(parsed.pages[:page_count], start=1):
        text_zh = item.text_zh.strip()
        pages.append(
            {
                "page_no": item.page_no or index,
                "title": item.title or f"{title} 第 {index} 页",
                "text_zh": text_zh,
                "text_en": item.text_en,
                "narration_text": item.narration_text or text_zh,
                "visual_prompt": item.visual_prompt or f"儿童绘本插图，第 {index} 页，温暖明亮。",
                "character_appearances": item.character_appearances,
                "dialogues": item.dialogues,
            }
        )
    if len(pages) != page_count:
        raise AiProviderError("分镜页数不符合要求", error_code="STRUCTURED_PAGE_COUNT_MISMATCH")
    return {"pages": pages}


def parse_json_response(text: str) -> dict | list:
    stripped = text.strip()
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass
    match = re.search(r"```(?:json)?\s*(\{.*\}|\[.*\])\s*```", stripped, re.DOTALL)
    if match:
        return json.loads(match.group(1))
    for pattern in (r"\[\s*\{.*\}\s*\]", r"\{.*\}"):
        match = re.search(pattern, stripped, re.DOTALL)
        if match:
            return json.loads(match.group(0))
    raise ValueError("无法从模型响应中提取 JSON")
