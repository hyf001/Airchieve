"""
Page & Layer Schemas
页面与图层的 Pydantic 请求/响应模型
"""
from datetime import datetime
from typing import Optional, TypedDict, Union

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Page Schemas
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Storyboard (TypedDict, 供 StorybookPage 和 ORM 共用)
# ---------------------------------------------------------------------------

class Storyboard(TypedDict):
    scene: str       # 场景环境
    characters: str  # 人物与动作
    shot: str        # 景别构图
    color: str       # 色调氛围
    lighting: str    # 光线


class StorybookPage(BaseModel):
    """创建绘本时的页面输入（前端请求体）"""
    text: str
    image_url: str = ""
    storyboard: Optional[Storyboard] = None
    page_type: str = "content"


# ---------------------------------------------------------------------------
# Page Schemas
# ---------------------------------------------------------------------------

class PageBase(BaseModel):
    text: str = ""
    page_type: str = "content"


class PageCreate(BaseModel):
    """创建页面"""
    storybook_id: int
    page_index: int
    image_url: str = ""
    text: str = ""
    page_type: str = "content"
    status: str = "pending"
    error_message: Optional[str] = None
    storyboard: Optional[Storyboard] = None


class TextUpdate(BaseModel):
    """更新页面text"""
    text: Optional[str] = None


class PageResponse(BaseModel):
    """页面响应"""
    model_config = {"from_attributes": True}

    id: int
    storybook_id: int
    page_index: int
    image_url: str
    text: str
    page_type: str
    status: str
    error_message: Optional[str] = None
    storyboard: Optional[Storyboard] = None
    created_at: datetime
    updated_at: datetime


class PageDetailResponse(PageResponse):
    """页面详情响应（含图层列表）"""
    layers: list["LayerResponse"] = []


class BaseImageUpdate(BaseModel):
    """替换基图"""
    image_url: str


# ---------------------------------------------------------------------------
# Layer Content Schemas（按 layer_type 收窄 content 结构）
# ---------------------------------------------------------------------------

class TextLayerContent(BaseModel):
    """文字图层内容"""
    x: float
    y: float
    width: float
    height: float
    text: str = ""
    fontFamily: str = '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: float = 24
    fontColor: str = "#000000"
    fontWeight: str = "normal"          # "normal" | "bold"
    textAlign: str = "center"
    lineHeight: float = 1.2
    backgroundColor: str = ""
    borderRadius: float = 0
    rotation: float = 0


class DrawLayerContent(BaseModel):
    """绘画图层内容"""
    strokes: list[dict] = []


class ImageLayerContent(BaseModel):
    """图片图层内容"""
    x: float = 0
    y: float = 0
    width: float = 100
    height: float = 100
    url: str = ""
    rotation: float = 0
    opacity: float = 1


# 联合类型：content 字段的合法取值
LayerContent = Union[TextLayerContent, DrawLayerContent, ImageLayerContent, dict]


# ---------------------------------------------------------------------------
# Layer Schemas
# ---------------------------------------------------------------------------

class LayerCreate(BaseModel):
    """创建图层"""
    layer_type: str
    layer_index: int = 0
    content: Optional[LayerContent] = None


class LayerUpdate(BaseModel):
    """更新图层（只传需要更新的字段）"""
    layer_type: Optional[str] = None
    layer_index: Optional[int] = None
    visible: Optional[bool] = None
    locked: Optional[bool] = None
    content: Optional[LayerContent] = None


class LayerResponse(BaseModel):
    """图层响应"""
    model_config = {"from_attributes": True}

    id: int
    page_id: int
    layer_type: str
    layer_index: int
    visible: bool
    locked: bool
    content: Optional[LayerContent] = None
    created_at: datetime
    updated_at: datetime


class RegeneratePageRequest(BaseModel):
    """页面重新生成请求"""
    regenerate_text: bool = False
    text_instruction: str = ""
    regenerate_storyboard: bool = False
    storyboard_instruction: str = ""
    regenerate_image: bool = True
    image_instruction: str = ""
    reference_page_ids: list[int] = []


class RegeneratePageResponse(BaseModel):
    """页面重新生成响应"""
    storybook_id: int
    page_id: int
    status: str


class LayerReorder(BaseModel):
    """批量调整图层顺序"""
    layer_ids: list[int] = Field(..., description="按新顺序排列的图层 ID 列表")
