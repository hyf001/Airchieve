import re

from pydantic import BaseModel, Field, RootModel, ValidationError

from app.schema.ai_provider import (
    GeneratedStoryContent,
    PictureBookStoryboard,
    StoryboardCharacterAppearance,
    StoryboardDialogueMark,
    StoryboardPage,
    StoryboardPlaybackSegment,
    StoryboardPlaybackSegmentType,
)
from app.service.ai_provider.errors import AiProviderError


class _StoryResponse(BaseModel):
    title: str = ""
    summary: str = ""
    body: str = ""
    content: str = ""


class _StoryboardPageResponse(BaseModel):
    page_no: int | None = None
    title: str | None = None
    text_zh: str = ""
    text_en: str | None = None
    narration_text: str | None = None
    visual_prompt: str = ""
    character_appearances: list[StoryboardCharacterAppearance] = Field(default_factory=list)
    dialogues: list[StoryboardDialogueMark] = Field(default_factory=list)
    playback_segments: list[StoryboardPlaybackSegment] = Field(default_factory=list)


class _StoryboardResponse(BaseModel):
    pages: list[_StoryboardPageResponse]


class _StoryboardPageListResponse(RootModel[list[_StoryboardPageResponse]]):
    pass


StoryContentResponse = str | GeneratedStoryContent
StoryboardResponse = str | PictureBookStoryboard


def story_text_from_response(raw_text: str, *, fallback_title: str) -> str:
    try:
        story = _model_from_json_text(raw_text, _StoryResponse)
        content = (story.body or story.content).strip()
        if content:
            title = story.title.strip() or fallback_title or "专属故事"
            return f"{title}\n\n{content}"
    except (ValueError, ValidationError):
        pass
    return raw_text.strip()


def story_from_response(
    response: StoryContentResponse,
    *,
    fallback_title: str,
    fallback_summary: str,
) -> GeneratedStoryContent:
    if isinstance(response, GeneratedStoryContent):
        return response
    try:
        story = _model_from_json_text(response, _StoryResponse)
        content = (story.body or story.content).strip()
        if content:
            return GeneratedStoryContent(
                title=(story.title.strip() or fallback_title or "专属故事")[:160],
                summary=(story.summary.strip() or fallback_summary or content[:80])[:1000],
                body=content[:3000],
            )
    except (ValueError, ValidationError):
        pass
    content = response.strip()
    return GeneratedStoryContent(
        title=(fallback_title or "专属故事")[:160],
        summary=(fallback_summary or content[:80])[:1000],
        body=content[:3000],
    )


def storyboard_from_response(response: StoryboardResponse, *, title: str, page_count: int) -> PictureBookStoryboard:
    if isinstance(response, PictureBookStoryboard):
        parsed = response
    else:
        try:
            parsed = _model_from_json_text(response, _StoryboardResponse)
        except ValidationError as exc:
            try:
                page_list = _model_from_json_text(response, _StoryboardPageListResponse)
            except (ValueError, ValidationError) as list_exc:
                raise AiProviderError("分镜响应结构不符合约定", error_code="STRUCTURED_SCHEMA_ERROR") from list_exc
            parsed = _StoryboardResponse(pages=page_list.root)
    return _normalize_storyboard(parsed.pages, title=title, page_count=page_count)


def _normalize_storyboard(
    source_pages: list[_StoryboardPageResponse] | list[StoryboardPage],
    *,
    title: str,
    page_count: int,
) -> PictureBookStoryboard:
    pages: list[StoryboardPage] = []
    for index, item in enumerate(source_pages[:page_count], start=1):
        text_zh = item.text_zh.strip()
        playback_segments = _normalized_playback_segments(item, fallback_text=text_zh)
        pages.append(
            StoryboardPage(
                page_no=item.page_no or index,
                title=item.title or f"{title} 第 {index} 页",
                text_zh=text_zh,
                text_en=item.text_en,
                narration_text=item.narration_text or _joined_narration_text(playback_segments) or text_zh,
                visual_prompt=item.visual_prompt or f"儿童绘本插图，第 {index} 页，温暖明亮。",
                character_appearances=item.character_appearances,
                dialogues=item.dialogues,
                playback_segments=playback_segments,
            )
        )
    if len(pages) != page_count:
        raise AiProviderError("分镜页数不符合要求", error_code="STRUCTURED_PAGE_COUNT_MISMATCH")
    return PictureBookStoryboard(pages=pages)


def _normalized_playback_segments(
    item: _StoryboardPageResponse | StoryboardPage,
    *,
    fallback_text: str,
) -> list[StoryboardPlaybackSegment]:
    if item.playback_segments:
        return sorted(item.playback_segments, key=lambda segment: segment.sort_order)
    segments: list[StoryboardPlaybackSegment] = []
    narration_text = str(item.narration_text or "").strip()
    if narration_text:
        segments.append(
            StoryboardPlaybackSegment(
                segment_type=StoryboardPlaybackSegmentType.NARRATION,
                text=narration_text,
                sort_order=0,
            )
        )
    for index, dialogue in enumerate(item.dialogues, start=1):
        text = str(dialogue.text or "").strip()
        if not text:
            continue
        segments.append(
            StoryboardPlaybackSegment(
                segment_type=StoryboardPlaybackSegmentType.DIALOGUE,
                text=text,
                speaker_ref=dialogue.speaker_ref,
                start_ms=dialogue.start_ms,
                end_ms=dialogue.end_ms,
                sort_order=dialogue.sort_order or index,
            )
        )
    if not segments and fallback_text:
        segments.append(
            StoryboardPlaybackSegment(
                segment_type=StoryboardPlaybackSegmentType.NARRATION,
                text=fallback_text,
                sort_order=0,
            )
        )
    return sorted(segments, key=lambda segment: segment.sort_order)


def _joined_narration_text(segments: list[StoryboardPlaybackSegment]) -> str | None:
    text = "\n".join(
        segment.text.strip()
        for segment in segments
        if segment.segment_type == StoryboardPlaybackSegmentType.NARRATION and segment.text.strip()
    )
    return text or None


def _model_from_json_text[ModelT: BaseModel](text: str, schema: type[ModelT]) -> ModelT:
    return schema.model_validate_json(_json_fragment(text))


def _json_fragment(text: str) -> str:
    stripped = text.strip()
    match = re.search(r"```(?:json)?\s*(\{.*\}|\[.*\])\s*```", stripped, re.DOTALL)
    if match:
        return match.group(1)
    for pattern in (r"\[\s*\{.*\}\s*\]", r"\{.*\}"):
        match = re.search(pattern, stripped, re.DOTALL)
        if match:
            return match.group(0)
    raise ValueError("无法从模型响应中提取 JSON")
