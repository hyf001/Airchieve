import re

from pydantic import BaseModel, Field, RootModel, ValidationError

from app.schema.ai_provider import (
    GeneratedStoryContent,
    PictureBookStoryboard,
    StoryPromptCharacter,
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
    characters: list[StoryPromptCharacter] = Field(default_factory=list)


class _StoryboardPageResponse(BaseModel):
    page_no: int | None = None
    title: str | None = None
    text_zh: str = ""
    text_en: str | None = None
    narration_text: str | None = None
    visual_prompt: str = ""
    character_appearances: list[StoryboardCharacterAppearance] = Field(default_factory=list)
    dialogues: list["_StoryboardDialogueResponse"] = Field(default_factory=list)
    playback_segments: list[StoryboardPlaybackSegment] = Field(default_factory=list)


class _StoryboardDialogueResponse(BaseModel):
    speaker_ref: str | None = None
    text: str = ""
    narration_text: str | None = None
    start_ms: int | None = None
    end_ms: int | None = None
    sort_order: int = 0


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
                characters=story.characters,
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
                visual_prompt=item.visual_prompt or f"儿童绘本插图，第 {index} 页，温暖明亮。",
                character_appearances=item.character_appearances,
                dialogues=_normalized_dialogues(item.dialogues),
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
        return _merge_narration_segments(sorted(item.playback_segments, key=lambda segment: segment.sort_order))
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
        narration_text = str(dialogue.narration_text or "").strip()
        if narration_text:
            segments.append(
                StoryboardPlaybackSegment(
                    segment_type=StoryboardPlaybackSegmentType.NARRATION,
                    text=narration_text,
                    sort_order=(dialogue.sort_order or index) - 1,
                )
            )
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
    return _merge_narration_segments(sorted(segments, key=lambda segment: segment.sort_order))


def _normalized_dialogues(dialogues: list[_StoryboardDialogueResponse] | list[StoryboardDialogueMark]) -> list[StoryboardDialogueMark]:
    normalized: list[StoryboardDialogueMark] = []
    for dialogue in dialogues:
        text = str(dialogue.text or "").strip()
        if not text:
            continue
        normalized.append(
            StoryboardDialogueMark(
                speaker_ref=dialogue.speaker_ref,
                text=text,
                start_ms=dialogue.start_ms,
                end_ms=dialogue.end_ms,
                sort_order=dialogue.sort_order,
            )
        )
    return normalized


def _merge_narration_segments(segments: list[StoryboardPlaybackSegment]) -> list[StoryboardPlaybackSegment]:
    normalized: list[StoryboardPlaybackSegment] = []
    pending_narration: StoryboardPlaybackSegment | None = None

    def flush_pending_narration() -> None:
        nonlocal pending_narration
        if pending_narration is not None:
            normalized.append(pending_narration.model_copy(update={"sort_order": len(normalized)}))
            pending_narration = None

    for segment in segments:
        text = segment.text.strip()
        if not text:
            continue
        if segment.segment_type == StoryboardPlaybackSegmentType.NARRATION:
            if pending_narration is None:
                pending_narration = segment.model_copy(update={"text": text})
            else:
                pending_narration = pending_narration.model_copy(update={"text": f"{pending_narration.text}\n{text}"})
            continue
        flush_pending_narration()
        normalized.append(segment.model_copy(update={"text": text, "sort_order": len(normalized)}))

    flush_pending_narration()
    return normalized


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
