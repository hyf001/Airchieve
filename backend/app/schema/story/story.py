from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.model.story import (
    StoryAccessLevel,
    StoryLanguage,
    StoryModerationStatus,
    StoryPublishStatus,
    StorySourceType,
)
from app.schema.book import BookSummary
from app.schema.generation_task import GenerationTaskRead


class StorySummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_user_id: int | None = None
    source_type: StorySourceType
    title: str
    summary: str | None = None
    cover_url: str | None = None
    age_range_codes: list[str] = Field(default_factory=list)
    theme_codes: list[str] = Field(default_factory=list)
    education_goal_codes: list[str] = Field(default_factory=list)
    language: StoryLanguage
    narrative_style_code: str | None = None
    access_level: StoryAccessLevel
    publish_status: StoryPublishStatus
    view_count: int
    created_at: datetime
    updated_at: datetime


class StoryRead(StorySummary):
    body: str
    moderation_status: StoryModerationStatus
    generated_books: list[BookSummary] = Field(default_factory=list)


class StoryListRead(BaseModel):
    items: list[StorySummary]
    total: int
    limit: int
    offset: int


class StoryCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    summary: str | None = Field(default=None, max_length=1000)
    body: str = Field(min_length=1, max_length=3000)
    source_type: StorySourceType = StorySourceType.USER
    age_range_codes: list[str] = Field(default_factory=list)
    theme_codes: list[str] = Field(default_factory=list)
    education_goal_codes: list[str] = Field(default_factory=list)
    language: StoryLanguage = StoryLanguage.ZH
    narrative_style_code: str | None = None


class StoryGenerateRequest(BaseModel):
    idea_prompt: str = Field(min_length=2, max_length=1000)
    age_range_codes: list[str] = Field(default_factory=list)
    theme_codes: list[str] = Field(default_factory=list)
    education_goal_codes: list[str] = Field(default_factory=list)
    language: StoryLanguage = StoryLanguage.ZH
    narrative_style_code: str | None = None


class StoryGenerationTaskResponse(BaseModel):
    story: StoryRead
    task: GenerationTaskRead


class StoryUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    summary: str | None = Field(default=None, max_length=1000)
    body: str | None = Field(default=None, min_length=1, max_length=3000)
    age_range_codes: list[str] | None = None
    theme_codes: list[str] | None = None
    education_goal_codes: list[str] | None = None
    language: StoryLanguage | None = None
    narrative_style_code: str | None = None
    publish_status: StoryPublishStatus | None = None


class StoryInternalDTO(BaseModel):
    id: int
    owner_user_id: int | None = None
    title: str
    body: str
    language: StoryLanguage
    age_range_codes: list[str] = Field(default_factory=list)
    theme_codes: list[str] = Field(default_factory=list)
    education_goal_codes: list[str] = Field(default_factory=list)
    access_level: StoryAccessLevel


class StartCreationFromStoryRequest(BaseModel):
    profile_id: int | None = None
    note: str | None = Field(default=None, max_length=500)


class StoryCreationSessionRead(BaseModel):
    session_id: int | None = None
    source_story_id: int
    story_title: str
    prefilled_language: StoryLanguage
    prefilled_age_range_codes: list[str] = Field(default_factory=list)
    prefilled_theme_codes: list[str] = Field(default_factory=list)
    guidance: str
