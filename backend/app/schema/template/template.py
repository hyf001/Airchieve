from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.model.template import (
    TemplateAccessLevel,
    TemplateRegionStatus,
    TemplateStatus,
    TemplateValidationStatus,
    TemplateVoiceScope,
)
from app.schema.book import BookDetailRead
from app.schema.generation_task import GenerationTaskRead


class TemplateRegionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    template_id: int
    template_character_id: int
    page_id: int
    page_no: int
    x: float
    y: float
    width: float
    height: float
    mask_asset_id: int | None = None
    z_index: int
    border_radius: float | None = None
    replacement_rule: dict = Field(default_factory=dict)
    status: TemplateRegionStatus


class TemplateCharacterRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    template_id: int
    role_code: str
    name: str
    description: str | None = None
    required: bool
    default_character_id: int | None = None
    default_character_name: str | None = None
    allowed_replacement_sources: list[str] = Field(default_factory=list)
    appear_page_nos: list[int] = Field(default_factory=list)
    sort_order: int
    regions: list[TemplateRegionRead] = Field(default_factory=list)


class TemplateSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source_book_id: int
    title: str
    summary: str | None = None
    cover_url: str | None = None
    default_voice_id: int | None = None
    default_voice_name: str | None = None
    access_level: TemplateAccessLevel
    allow_voice_replacement: bool
    allowed_voice_scope: TemplateVoiceScope
    status: TemplateStatus
    validation_status: TemplateValidationStatus
    sort_order: int
    character_count: int = 0
    page_count: int | None = None


class TemplateRead(TemplateSummary):
    characters: list[TemplateCharacterRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class TemplateListRead(BaseModel):
    items: list[TemplateSummary]
    total: int
    limit: int
    offset: int


class TemplateReplacement(BaseModel):
    role_code: str
    source: str = Field(min_length=1, max_length=80)
    character_id: int | None = None
    upload_asset_id: int | None = None
    display_name: str | None = Field(default=None, max_length=120)
    keep_default: bool = False


class TemplateVoiceReplacement(BaseModel):
    source: str = Field(default="template_default", max_length=80)
    voice_id: int | None = None
    display_name: str | None = Field(default=None, max_length=120)


class TemplateReplacementRequest(BaseModel):
    replacements: list[TemplateReplacement] = Field(default_factory=list)
    voice_ref: TemplateVoiceReplacement | None = None


class TemplateValidationIssue(BaseModel):
    role_code: str | None = None
    message: str


class TemplateValidationResult(BaseModel):
    valid: bool
    missing_required_role_codes: list[str] = Field(default_factory=list)
    issues: list[TemplateValidationIssue] = Field(default_factory=list)


class TemplatePreviewResponse(BaseModel):
    validation: TemplateValidationResult
    task: GenerationTaskRead | None = None


class TemplateCreateBookResponse(BaseModel):
    validation: TemplateValidationResult
    task: GenerationTaskRead
    book: BookDetailRead | None = None
