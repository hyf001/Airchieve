from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field

from app.model.book import (
    BookAccessLevel,
    BookContentStatus,
    BookLanguage,
    BookLipSyncStatus,
    BookPlaybackMediaMode,
    BookPlaybackSegmentType,
    BookPromptType,
    BookPublishStatus,
    BookSegmentFallbackMode,
    BookSoundEffectTriggerType,
    BookSubtitleCueType,
    BookSubtitlePosition,
)
from app.schema.entitlement import AccessDecision


class BookSort(StrEnum):
    FEATURED = "featured"
    NEWEST = "newest"
    POPULAR = "popular"


class BookSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    subtitle: str | None = None
    summary: str | None = None
    cover_url: str | None = None
    age_range_codes: list[str] = Field(default_factory=list)
    theme_codes: list[str] = Field(default_factory=list)
    education_goal_codes: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    language: BookLanguage
    reading_level: str | None = None
    page_count: int
    duration_seconds: int
    access_level: BookAccessLevel
    play_count: int
    favorite_count: int


class BookDetailRead(BookSummary):
    source_story_id: int | None = None
    narrative_style_code: str | None = None
    art_style_code: str | None = None
    background_music_id: int | None = None
    background_music_url: str | None = None
    publish_status: BookPublishStatus
    is_featured: bool
    created_at: datetime
    updated_at: datetime
    related_books: list[BookSummary] = Field(default_factory=list)


class BookSubtitleCueRead(BaseModel):
    id: int
    cue_type: BookSubtitleCueType
    speaker_ref: str | None = None
    start_ms: int
    end_ms: int | None = None
    text_zh: str | None = None
    text_en: str | None = None
    position: BookSubtitlePosition
    position_config: dict | None = None
    sort_order: int


class BookSoundEffectCueRead(BaseModel):
    id: int
    segment_id: int | None = None
    trigger_type: BookSoundEffectTriggerType
    sound_effect_url: str
    start_ms: int
    end_ms: int | None = None
    volume: int
    loop: bool
    sort_order: int


class BookPlaybackSegmentRead(BaseModel):
    id: int
    segment_type: BookPlaybackSegmentType
    speaker_ref: str | None = None
    image_url: str | None = None
    audio_url: str | None = None
    lip_sync_url: str | None = None
    media_mode: BookPlaybackMediaMode
    start_ms: int | None = None
    end_ms: int | None = None
    fallback_mode: BookSegmentFallbackMode
    lip_sync_status: BookLipSyncStatus
    sort_order: int
    subtitle_cues: list[BookSubtitleCueRead] = Field(default_factory=list)
    sound_effects: list[BookSoundEffectCueRead] = Field(default_factory=list)


class BookPageRead(BaseModel):
    id: int
    page_no: int
    title: str | None = None
    text_zh: str | None = None
    text_en: str | None = None
    visual_prompt: str | None = None
    image_url: str | None = None
    audio_url: str | None = None
    duration_seconds: int | None = None
    playback_segments: list[BookPlaybackSegmentRead] = Field(default_factory=list)
    sound_effects: list[BookSoundEffectCueRead] = Field(default_factory=list)


class BookReadingPromptRead(BaseModel):
    id: int
    prompt_type: BookPromptType
    content: str
    page_no: int | None = None
    status: BookContentStatus
    sort_order: int


class BookLearningCardRead(BaseModel):
    id: int
    theme: str | None = None
    education_goals: list[str] = Field(default_factory=list)
    vocabulary: list[str] = Field(default_factory=list)
    discussion_questions: list[str] = Field(default_factory=list)
    status: BookContentStatus
    sort_order: int


class BookVoiceOption(BaseModel):
    id: int | None = None
    name: str
    source: str = "system"


class BookPlayerOptions(BaseModel):
    child_profile_id: int | None = None
    text_mode: BookLanguage | None = None
    voice_id: int | None = None


class BookPlayerPayload(BaseModel):
    book: BookDetailRead
    pages: list[BookPageRead]
    reading_prompts: list[BookReadingPromptRead] = Field(default_factory=list)
    learning_cards: list[BookLearningCardRead] = Field(default_factory=list)
    access_decision: AccessDecision | None = None
    can_read_full_book: bool = True
    preview_page_count: int | None = None
    default_text_mode: BookLanguage
    default_voice: BookVoiceOption | None = None
    voice_options: list[BookVoiceOption] = Field(default_factory=list)


class BookListRead(BaseModel):
    items: list[BookSummary]
    total: int
    limit: int
    offset: int


class BookSimilarCreationRequest(BaseModel):
    profile_id: int | None = None
    note: str | None = Field(default=None, max_length=500)


class SimilarCreationSessionRead(BaseModel):
    session_id: int | None = None
    source_book_id: int
    source_title: str
    prefilled_theme_codes: list[str] = Field(default_factory=list)
    prefilled_age_range_codes: list[str] = Field(default_factory=list)
    prefilled_education_goal_codes: list[str] = Field(default_factory=list)
    prefilled_page_count: int
    prefilled_art_style_code: str | None = None
    guidance: str
