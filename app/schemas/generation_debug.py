from datetime import datetime

from pydantic import BaseModel, Field


class GenerationDebugStoryboard(BaseModel):
    summary: str = ""
    visual_brief: str = ""
    anchor_refs: list[str] = Field(default_factory=list)
    must_include: list[str] = Field(default_factory=list)
    composition: str = ""
    avoid: list[str] = Field(default_factory=list)


class GenerationDebugVisualAnchor(BaseModel):
    id: str
    type: str
    name: str
    description: str = ""
    key_attributes: list[str] = Field(default_factory=list)


class PageGenerationDebugParams(BaseModel):
    cli_type: str
    page_index: int
    story_text: str
    storyboard: GenerationDebugStoryboard | None = None
    story_context: list[str] = Field(default_factory=list)
    visual_anchors: list[GenerationDebugVisualAnchor] = Field(default_factory=list)
    image_style_id: int | None = None
    image_style_version_id: int | None = None
    style_name: str = ""
    style_generation_prompt: str = ""
    style_negative_prompt: str = ""
    style_reference_images: list[str] = Field(default_factory=list)
    aspect_ratio: str
    image_size: str
    image_instruction: str = ""
    previous_page_image: str | None = None
    character_reference_images: list[str] = Field(default_factory=list)
    selected_reference_page_images: list[str] = Field(default_factory=list)


class GenerationDebugStorybookItem(BaseModel):
    id: int
    title: str
    status: str
    image_style_id: int | None = None
    image_style_version_id: int | None = None
    cli_type: str
    page_count: int
    created_at: datetime


class GenerationDebugPageItem(BaseModel):
    id: int
    page_index: int
    content_page_index: int
    text: str
    image_url: str
    status: str
    storyboard: GenerationDebugStoryboard | None = None


class GenerationDebugDisplayContext(BaseModel):
    storybook_id: int
    storybook_title: str
    page_id: int
    page_index: int
    content_page_index: int
    page_status: str
    image_url: str
    story_text: str
    storyboard: GenerationDebugStoryboard | None = None
    visual_anchors: list[GenerationDebugVisualAnchor] = Field(default_factory=list)
    image_style_id: int | None = None
    image_style_version_id: int | None = None
    style_name: str = ""


class GenerationDebugPageContextResponse(BaseModel):
    display_context: GenerationDebugDisplayContext
    debug_params: PageGenerationDebugParams


class GenerationDebugInputResourceResponse(BaseModel):
    role: str
    url: str
    source: str = ""
    source_id: int | None = None
    sort_order: int = 0
    note: str = ""


class GenerationDebugPromptPreviewResponse(BaseModel):
    prompt: str
    input_resources: list[GenerationDebugInputResourceResponse] = Field(default_factory=list)


class GenerationDebugRunResponse(BaseModel):
    id: int
    storybook_id: int
    page_id: int
    admin_user_id: int
    status: str
    debug_params: PageGenerationDebugParams
    output_image_url: str | None = None
    error_message: str | None = None
    rating: int | None = None
    tags: list[str] = Field(default_factory=list)
    notes: str = ""
    created_at: datetime
    updated_at: datetime


class GenerationDebugRunUpdate(BaseModel):
    rating: int | None = Field(None, ge=1, le=5)
    tags: list[str] | None = None
    notes: str | None = None
