from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class StoryPromptCharacter(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str | None = Field(default=None, max_length=120)
    is_protagonist: bool = False
    role_code: str | None = Field(default=None, max_length=80)
    display_name: str | None = Field(default=None, max_length=120)


class GeneratedStoryContent(BaseModel):
    title: str = Field(max_length=160)
    summary: str = Field(max_length=1000)
    body: str = Field(max_length=3000)
    characters: list[StoryPromptCharacter] = Field(default_factory=list)


class StoryGenerationRequest(BaseModel):
    idea_prompt: str = Field(min_length=1, max_length=5000)
    characters: list[StoryPromptCharacter] = Field(default_factory=list)
    target_word_count: int = Field(default=800, ge=300, le=2000)
    language: str = Field(default="zh", max_length=32)
    age_ranges: list[str] = Field(default_factory=list)
    themes: list[str] = Field(default_factory=list)
    narrative_style: str | None = Field(default=None, max_length=1000)


class StoryboardCharacterAppearance(BaseModel):
    model_config = ConfigDict(extra="ignore")

    role_code: str = Field(max_length=80)
    display_name: str | None = Field(default=None, max_length=120)


class PageCharacterImageRef(StoryboardCharacterAppearance):
    character_id: int | None = None
    image_url: str | None = Field(default=None, max_length=500)


class StoryboardDialogueMark(BaseModel):
    model_config = ConfigDict(extra="ignore")

    speaker_ref: str | None = Field(default=None, max_length=160)
    text: str = Field(default="", max_length=500)
    start_ms: int | None = None
    end_ms: int | None = None
    sort_order: int = 0


class StoryboardPlaybackSegmentType(StrEnum):
    NARRATION = "narration"
    DIALOGUE = "dialogue"


class ImageAspectRatio(StrEnum):
    SQUARE = "1:1"
    LANDSCAPE_STANDARD = "4:3"
    PORTRAIT_STANDARD = "3:4"
    LANDSCAPE_WIDE = "16:9"
    PORTRAIT_WIDE = "9:16"


class StoryboardPlaybackSegment(BaseModel):
    model_config = ConfigDict(extra="ignore")

    segment_type: StoryboardPlaybackSegmentType
    text: str = Field(min_length=1, max_length=500)
    speaker_ref: str | None = Field(default=None, max_length=160)
    start_ms: int | None = None
    end_ms: int | None = None
    audio_url: str | None = None
    audio_asset_id: int | None = None
    lip_sync_url: str | None = None
    sort_order: int = 0


class StoryboardPage(BaseModel):
    page_no: int = Field(ge=1, le=24)
    title: str | None = Field(default=None, max_length=160)
    text_zh: str = Field(default="", max_length=1200)
    text_en: str | None = Field(default=None, max_length=1600)
    visual_prompt: str = Field(default="", max_length=2000)
    character_appearances: list[StoryboardCharacterAppearance] = Field(default_factory=list)
    dialogues: list[StoryboardDialogueMark] = Field(default_factory=list)
    playback_segments: list[StoryboardPlaybackSegment] = Field(default_factory=list)


class PictureBookStoryboard(BaseModel):
    pages: list[StoryboardPage]


class PictureBookStoryboardRequest(BaseModel):
    title: str = Field(default="专属绘本", max_length=160)
    story_content: str = Field(min_length=1, max_length=5000)
    characters: list[StoryPromptCharacter] = Field(default_factory=list)
    character_refs: list[StoryPromptCharacter] = Field(default_factory=list)
    target_page_count: int = Field(default=8, ge=1, le=24)


class VoicePromptRef(BaseModel):
    model_config = ConfigDict(extra="ignore")

    source: str | None = Field(default=None, max_length=64)
    voice_id: int | None = None
    role_code: str | None = Field(default=None, max_length=80)
    display_name: str | None = Field(default=None, max_length=120)
    voice_name: str | None = Field(default=None, max_length=120)
    voice_type: str | None = Field(default=None, max_length=120)
    provider_voice_id: str | None = Field(default=None, max_length=120)
    voice_language: str | None = Field(default=None, max_length=16)
    emotion_type: str | None = Field(default=None, max_length=64)
    emotion: str | None = Field(default=None, max_length=64)
    role_voice_refs: list["VoicePromptRef"] = Field(default_factory=list)


class PageMediaInput(BaseModel):
    id: int
    page_no: int | None = None
    title: str | None = Field(default=None, max_length=160)
    text_zh: str | None = Field(default=None, max_length=1200)
    text_en: str | None = Field(default=None, max_length=1600)
    visual_prompt: str | None = Field(default=None, max_length=2000)
    art_style_prompt: str | None = Field(default=None, max_length=2000)
    all_character_refs: list[PageCharacterImageRef] = Field(default_factory=list)
    character_appearances: list[PageCharacterImageRef] = Field(default_factory=list)
    continuity_image_urls: list[str] = Field(default_factory=list)
    dialogues: list[StoryboardDialogueMark] = Field(default_factory=list)
    playback_segments: list[StoryboardPlaybackSegment] = Field(default_factory=list)
    voice_config: VoicePromptRef | None = None
    image_url: str | None = None
    audio_url: str | None = None
    lip_sync_url: str | None = None


class CharacterPortraitInput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    generation_prompt: str | None = Field(default=None, max_length=2000)
    art_style_prompt: str | None = Field(default=None, max_length=2000)
    category_code: str | None = Field(default=None, max_length=80)
    reference_image_url: str | None = Field(default=None, max_length=500)
    reference_image_policy: str = Field(default="preserve_identity_transfer_style", max_length=80)


class ImageGenerationRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    kind: str = Field(max_length=80)
    pages: list[PageMediaInput] = Field(default_factory=list)
    character: CharacterPortraitInput | None = None
    image_count: int = Field(default=1, ge=1, le=24)
    aspect_ratio: ImageAspectRatio = ImageAspectRatio.LANDSCAPE_STANDARD


class AudioGenerationRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    text: str = Field(min_length=1, max_length=5000)
    voice_ref: VoicePromptRef | None = None


class LipSyncGenerationRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    page: PageMediaInput
    audio_url: str = Field(min_length=1, max_length=2000)
    image_url: str = Field(min_length=1, max_length=2000)


class PageImageResult(BaseModel):
    page_id: int
    image_url: str
    image_asset_id: int | None = None


class PictureBookImageResult(BaseModel):
    page_results: list[PageImageResult]


class PageSegmentAudioResult(BaseModel):
    sort_order: int
    audio_url: str
    audio_asset_id: int | None = None


class PageAudioResult(BaseModel):
    page_id: int
    audio_url: str
    audio_asset_id: int | None = None
    segment_results: list[PageSegmentAudioResult] = Field(default_factory=list)


class PictureBookAudioResult(BaseModel):
    page_results: list[PageAudioResult]


class PageSegmentLipSyncResult(BaseModel):
    sort_order: int
    lip_sync_url: str


class PageLipSyncResult(BaseModel):
    page_id: int
    lip_sync_url: str
    segment_results: list[PageSegmentLipSyncResult] = Field(default_factory=list)


class PictureBookLipSyncResult(BaseModel):
    page_results: list[PageLipSyncResult]
