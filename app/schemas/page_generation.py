from dataclasses import dataclass, field


@dataclass
class PageGenerationStoryboard:
    summary: str = ""
    visual_brief: str = ""
    anchor_refs: list[str] = field(default_factory=list)
    must_include: list[str] = field(default_factory=list)
    composition: str = ""
    avoid: list[str] = field(default_factory=list)


@dataclass
class PageGenerationVisualAnchor:
    id: str
    type: str
    name: str
    description: str = ""
    key_attributes: list[str] = field(default_factory=list)


@dataclass
class PageGenerationStyleContext:
    name: str = ""
    generation_prompt: str = ""
    negative_prompt: str = ""
    reference_images: list[str] = field(default_factory=list)


@dataclass
class PageGenerationInputResource:
    role: str
    url: str
    source: str = ""
    source_id: int | None = None
    sort_order: int = 0
    note: str = ""


@dataclass
class PageGenerationContext:
    cli_type: str
    storybook_id: int | None
    page_id: int | None
    page_index: int
    story_text: str
    storyboard: PageGenerationStoryboard | None
    story_context: list[str]
    visual_anchors: list[PageGenerationVisualAnchor] = field(default_factory=list)
    style: PageGenerationStyleContext = field(default_factory=PageGenerationStyleContext)
    aspect_ratio: str = "16:9"
    image_size: str = "1k"
    image_instruction: str = ""
    previous_page_image: str | None = None
    character_reference_images: list[str] = field(default_factory=list)
    selected_reference_page_images: list[str] = field(default_factory=list)


@dataclass
class PageGenerationPreview:
    prompt: str
    input_resources: list[PageGenerationInputResource] = field(default_factory=list)
