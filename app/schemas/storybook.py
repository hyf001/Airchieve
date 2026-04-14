"""
Storybook Schemas
绘本相关的 Pydantic 请求/响应模型
"""
from typing import Optional

from pydantic import BaseModel, Field

from app.models.enums import AgeGroup, AspectRatio, CliType, ImageSize, Language, StoryType
from app.schemas.page import StorybookPage


class StorybookPagePreviewResponse(BaseModel):
    """绘本页面简要响应（用于绘本详情/列表中的嵌套展示）"""
    model_config = {"from_attributes": True}

    id: int
    text: Optional[str] = Field(None, description="页面文本")
    image_url: Optional[str] = Field(None, description="图片URL")
    page_type: Optional[str] = Field(None, description="页面类型")
    storyboard: Optional[dict] = Field(None, description="分镜信息")


class StorybookResponse(BaseModel):
    """绘本详情响应"""
    model_config = {"from_attributes": True}

    id: int
    title: str
    description: Optional[str]
    creator: str
    pages: Optional[list[StorybookPagePreviewResponse]]
    status: str
    error_message: Optional[str] = None
    instruction: Optional[str] = None
    template_id: Optional[int] = None
    cli_type: CliType
    aspect_ratio: AspectRatio
    image_size: ImageSize


class StorybookListResponse(BaseModel):
    """绘本列表响应"""
    model_config = {"from_attributes": True}

    id: int
    title: str
    description: Optional[str]
    creator: str
    status: str
    is_public: bool
    created_at: str
    pages: Optional[list[StorybookPagePreviewResponse]] = None
    cli_type: Optional[CliType]
    aspect_ratio: Optional[AspectRatio]
    image_size: Optional[ImageSize]


class EditImageRequest(BaseModel):
    """图片编辑请求（仅生成图片，不写库）"""
    instruction: str = Field(..., min_length=1, max_length=1000, description="图片编辑指令")
    image_to_edit: str = Field(..., description="要编辑的图片 URL 或 base64 data URL")
    referenced_image: Optional[str] = Field(None, description="参考图片 URL 或 base64 data URL（可选）")
    storybook_id: int = Field(..., description="绘本ID，用于获取模型、清晰度、图片比例等配置")


class InsertPagesRequest(BaseModel):
    """插入页面请求"""
    insert_position: int = Field(..., ge=0, description="插入位置（从0开始，0表示在最前面插入）")
    count: int = Field(1, ge=1, le=5, description="插入页面数量（1-5）")
    instruction: str = Field("", description="插入指令")


class InsertPageAsyncResponse(BaseModel):
    """插入页面异步响应"""
    storybook_id: int
    status: str


class UpdatePublicStatusRequest(BaseModel):
    """更新公开状态请求"""
    is_public: bool = Field(..., description="是否公开")


class StorybookCreateResponse(BaseModel):
    """创建/编辑绘本的异步响应"""
    id: int
    title: str
    status: str


class TerminateResponse(BaseModel):
    """中止响应"""
    success: bool
    message: str


class StorybookStatusResponse(BaseModel):
    """绘本状态响应（轻量，不包含 pages）"""
    id: int
    status: str
    error_message: Optional[str] = None
    updated_at: Optional[str] = None
    total_pages: int = 0
    completed_pages: int = 0


class GenerateCoverRequest(BaseModel):
    """生成封面请求"""
    selected_page_indices: Optional[list[int]] = Field(None, description="用户选择的参考页索引列表；不传则自动选首/中/尾")


class GenerateCoverResponse(BaseModel):
    """生成封面响应"""
    storybook_id: int
    status: str


class GenerateBackCoverRequest(BaseModel):
    """生成封底请求"""
    image_data: str = Field(..., description="封底图片的 base64 数据")


class GenerateBackCoverResponse(BaseModel):
    """生成封底响应"""
    storybook_id: int
    status: str


class CreateStoryRequest(BaseModel):
    """创建故事请求"""
    instruction: str = Field(..., min_length=1, max_length=1000, description="用户指令/故事描述")
    word_count: int = Field(500, ge=100, le=2000, description="目标字数")
    story_type: StoryType = Field(StoryType.FAIRY_TALE, description="故事类型")
    language: Language = Field(Language.ZH, description="语言")
    age_group: AgeGroup = Field(AgeGroup.AGE_3_6, description="年龄组")
    cli_type: CliType = Field(CliType.GEMINI, description="CLI类型")


class CreateStoryResponse(BaseModel):
    """创建故事响应"""
    title: str = Field(..., description="故事标题")
    content: str = Field(..., description="故事内容")


class CreateStorybookFromStoryRequest(BaseModel):
    """基于故事创建绘本请求"""
    title: str = Field(..., min_length=1, max_length=200, description="绘本标题")
    description: str = Field(..., min_length=1, max_length=1000, description="绘本描述/用户原始输入")
    template_id: Optional[int] = Field(None, description="模版ID")
    images: Optional[list[str]] = Field(None, description="参考图片列表（base64）")
    cli_type: CliType = Field(CliType.GEMINI, description="CLI类型")
    aspect_ratio: AspectRatio = Field(AspectRatio.RATIO_16_9, description="图片比例")
    image_size: ImageSize = Field(ImageSize.SIZE_1K, description="图片尺寸")
    pages: list[StorybookPage] = Field(..., description="页面列表（包含每页文本和分镜信息）")


class GenerateStoryboardRequest(BaseModel):
    """生成分镜请求"""
    story_content: str = Field(..., min_length=1, description="故事内容（纯文本）")
    page_count: int = Field(10, ge=1, le=20, description="页数")
    cli_type: CliType = Field(CliType.GEMINI, description="CLI类型")


class StoryboardItemResponse(BaseModel):
    """分镜项响应"""
    text: str = Field(..., description="页面文本")
    storyboard: Optional[dict] = Field(None, description="分镜信息")


class GenerateStoryboardResponse(BaseModel):
    """生成分镜响应"""
    storyboards: list[StoryboardItemResponse] = Field(..., description="分镜列表")
