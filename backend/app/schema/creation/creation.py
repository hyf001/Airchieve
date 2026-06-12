from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.model.creation import (
    CreationLanguage,
    PageDraftTaskStatus,
    CreationSessionStatus,
    CreationStep,
    CreationStorySourceType,
    CreationType,
)
from app.model.generation_task import GenerationTaskType
from app.schema.ai_provider import ImageAspectRatio
from app.schema.book import BookDetailRead
from app.schema.generation_task import GenerationTaskRead


class CharacterRefSource(StrEnum):
    STORY_ORIGINAL = "story_original"
    CHILD_PROFILE_DEFAULT = "child_profile_default"
    USER_CHARACTER = "user_character"
    SYSTEM_CHARACTER = "system_character"
    UPLOAD = "upload"
    GENERATED = "generated"


class ArtStyleSource(StrEnum):
    SYSTEM = "system"
    CUSTOM = "custom"


class VoiceRefSource(StrEnum):
    TEMPLATE_DEFAULT = "template_default"
    SYSTEM = "system"
    USER = "user"


class RegenerateTargetType(StrEnum):
    STORY = "story"
    STORYBOARD = "storyboard"
    PAGE_TEXT = "page_text"
    PAGE_IMAGE = "page_image"
    PAGE_DIALOGUE = "page_dialogue"
    PAGE_AUDIO = "page_audio"
    BOOK_AUDIO = "book_audio"
    LIP_SYNC = "lip_sync"


class CharacterRef(BaseModel):
    source: CharacterRefSource
    character_id: int | None = None
    role_code: str | None = Field(default=None, max_length=80)
    display_name: str | None = Field(default=None, max_length=120)


class ArtStyleRef(BaseModel):
    source: ArtStyleSource
    art_style_id: int | None = None
    art_style_code: str | None = Field(default=None, max_length=80)
    custom_prompt: str | None = Field(default=None, max_length=500)


class VoiceRef(BaseModel):
    source: VoiceRefSource
    voice_id: int | None = None
    display_name: str | None = Field(default=None, max_length=120)
    role_code: str | None = Field(default=None, max_length=80)
    provider_voice_id: str | None = Field(default=None, max_length=64)
    emotion_type: str | None = Field(default=None, max_length=64)
    role_voice_refs: list["VoiceRef"] = Field(default_factory=list)


class CharacterAppearance(BaseModel):
    role_code: str
    character_ref: str | None = None
    display_name: str | None = None


class DialogueMark(BaseModel):
    speaker_ref: str
    text: str = Field(min_length=1, max_length=500)
    narration_text: str | None = Field(default=None, max_length=500)
    start_ms: int | None = None
    end_ms: int | None = None
    sort_order: int = 0


class PlaybackSegmentMark(BaseModel):
    segment_type: str = Field(pattern="^(narration|dialogue)$")
    text: str = Field(min_length=1, max_length=500)
    speaker_ref: str | None = Field(default=None, max_length=160)
    start_ms: int | None = None
    end_ms: int | None = None
    sort_order: int = 0


class CreationSessionCreate(BaseModel):
    creation_type: CreationType
    child_profile_id: int | None = None
    story_source_type: CreationStorySourceType | None = None
    story_id: int | None = None
    template_id: int | None = None
    reference_book_id: int | None = None
    language: CreationLanguage = CreationLanguage.ZH
    target_page_count: int = Field(default=8, ge=6, le=12)
    age_range_codes: list[str] = Field(default_factory=list)
    theme_codes: list[str] = Field(default_factory=list)
    education_goal_codes: list[str] = Field(default_factory=list)
    narrative_style_code: str | None = None

    @model_validator(mode="after")
    def validate_creation_path(self) -> "CreationSessionCreate":
        if self.creation_type == CreationType.STORY_TO_BOOK and self.story_source_type is None:
            raise ValueError("story_to_book 必须提供 story_source_type")
        if self.creation_type == CreationType.TEMPLATE_BOOK and self.template_id is None:
            raise ValueError("template_book 必须提供 template_id")
        if self.creation_type == CreationType.SIMILAR_BOOK and self.reference_book_id is None:
            raise ValueError("similar_book 必须提供 reference_book_id")
        return self


class CreationConfigPatch(BaseModel):
    character_refs: list[CharacterRef] | None = None
    art_style_ref: ArtStyleRef | None = None
    voice_ref: VoiceRef | None = None
    language: CreationLanguage | None = None
    target_page_count: int | None = Field(default=None, ge=6, le=12)


class IdeaStoryGenerateRequest(BaseModel):
    idea_prompt: str = Field(min_length=2, max_length=1000)


class PageVoiceConfig(BaseModel):
    source: VoiceRefSource = VoiceRefSource.SYSTEM
    voice_id: int | None = None
    display_name: str | None = Field(default=None, max_length=120)
    role_code: str | None = Field(default=None, max_length=80)
    provider_voice_id: str | None = Field(default=None, max_length=64)
    emotion_type: str | None = Field(default=None, max_length=64)


class PageSubtitleConfig(BaseModel):
    position: str = Field(default="bottom", max_length=32)
    position_config: dict | None = None


class PageLipSyncConfig(BaseModel):
    enabled: bool = True
    target_role_code: str | None = Field(default=None, max_length=80)


class PageDraftPatch(BaseModel):
    page_no: int = Field(ge=1, le=24)
    title: str | None = Field(default=None, max_length=160)
    text_zh: str | None = Field(default=None, max_length=1200)
    text_en: str | None = Field(default=None, max_length=1600)
    narration_text: str | None = Field(default=None, max_length=1600)
    visual_prompt: str = Field(min_length=1, max_length=2000)
    character_appearances: list[CharacterAppearance] = Field(default_factory=list)
    dialogues: list[DialogueMark] = Field(default_factory=list)
    playback_segments: list[PlaybackSegmentMark] = Field(default_factory=list)
    voice_config: dict = Field(default_factory=dict)
    subtitle_config: PageSubtitleConfig = Field(default_factory=PageSubtitleConfig)
    lip_sync_config: PageLipSyncConfig = Field(default_factory=PageLipSyncConfig)


class GenerateImagesRequest(BaseModel):
    aspect_ratio: ImageAspectRatio = ImageAspectRatio.LANDSCAPE_STANDARD


class GeneratePagesRequest(BaseModel):
    page_ids: list[int] | None = None


class GeneratePageImageRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=500)
    override_prompt: str | None = Field(default=None, max_length=1000)
    aspect_ratio: ImageAspectRatio = ImageAspectRatio.LANDSCAPE_STANDARD


class RegenerateRequest(BaseModel):
    target_type: RegenerateTargetType
    page_ids: list[int] | None = None
    reason: str | None = Field(default=None, max_length=500)
    override_prompt: str | None = Field(default=None, max_length=1000)
    aspect_ratio: ImageAspectRatio = ImageAspectRatio.LANDSCAPE_STANDARD

    @model_validator(mode="after")
    def validate_page_targets(self) -> "RegenerateRequest":
        if self.target_type in {
            RegenerateTargetType.PAGE_TEXT,
            RegenerateTargetType.PAGE_IMAGE,
            RegenerateTargetType.PAGE_DIALOGUE,
            RegenerateTargetType.PAGE_AUDIO,
        } and not self.page_ids:
            raise ValueError("局部重生成必须指定 page_ids")
        return self


class PageDraftRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    page_no: int
    title: str | None = None
    text_zh: str | None = None
    text_en: str | None = None
    narration_text: str | None = None
    visual_prompt: str
    character_appearances: list[dict] = Field(default_factory=list)
    dialogues: list[dict] = Field(default_factory=list)
    playback_segments: list[dict] = Field(default_factory=list)
    voice_config: dict = Field(default_factory=dict)
    subtitle_config: dict = Field(default_factory=dict)
    lip_sync_config: dict = Field(default_factory=dict)
    image_asset_id: int | None = None
    image_url: str | None = None
    audio_asset_id: int | None = None
    audio_url: str | None = None
    lip_sync_url: str | None = None
    storyboard_status: PageDraftTaskStatus
    image_status: PageDraftTaskStatus
    audio_status: PageDraftTaskStatus
    lip_sync_status: PageDraftTaskStatus
    created_at: datetime
    updated_at: datetime


class CreationSessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    child_profile_id: int | None = None
    creation_type: CreationType
    status: CreationSessionStatus
    current_step: CreationStep
    story_source_type: CreationStorySourceType | None = None
    story_id: int | None = None
    template_id: int | None = None
    idea_prompt: str | None = None
    reference_book_id: int | None = None
    language: CreationLanguage
    target_page_count: int
    age_range_codes: list[str] = Field(default_factory=list)
    theme_codes: list[str] = Field(default_factory=list)
    education_goal_codes: list[str] = Field(default_factory=list)
    narrative_style_code: str | None = None
    character_refs: list[dict] = Field(default_factory=list)
    art_style_ref: dict | None = None
    voice_ref: dict | None = None
    saved_book_id: int | None = None
    page_drafts: list[PageDraftRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class CreationTaskResponse(BaseModel):
    session: CreationSessionRead
    task: GenerationTaskRead


class SaveBookResponse(BaseModel):
    session: CreationSessionRead
    book: BookDetailRead


TASK_TYPE_BY_REGENERATE_TARGET: dict[RegenerateTargetType, GenerationTaskType] = {
    RegenerateTargetType.STORY: GenerationTaskType.STORY,
    RegenerateTargetType.STORYBOARD: GenerationTaskType.STORYBOARD,
    RegenerateTargetType.PAGE_TEXT: GenerationTaskType.STORYBOARD,
    RegenerateTargetType.PAGE_IMAGE: GenerationTaskType.PAGE_IMAGE,
    RegenerateTargetType.PAGE_DIALOGUE: GenerationTaskType.STORYBOARD,
    RegenerateTargetType.PAGE_AUDIO: GenerationTaskType.AUDIO,
    RegenerateTargetType.BOOK_AUDIO: GenerationTaskType.AUDIO,
    RegenerateTargetType.LIP_SYNC: GenerationTaskType.LIP_SYNC,
}
