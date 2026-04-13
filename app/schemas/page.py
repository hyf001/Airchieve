"""
Page & Layer Schemas
页面与图层的 Pydantic 请求/响应模型
"""
from datetime import datetime
from typing import Any, Optional, TypedDict

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
# Layer Schemas
# ---------------------------------------------------------------------------

class LayerCreate(BaseModel):
    """创建图层"""
    layer_type: str
    layer_index: int = 0
    content: Optional[Any] = None


class LayerUpdate(BaseModel):
    """更新图层（只传需要更新的字段）"""
    layer_type: Optional[str] = None
    layer_index: Optional[int] = None
    visible: Optional[bool] = None
    locked: Optional[bool] = None
    content: Optional[Any] = None


class LayerResponse(BaseModel):
    """图层响应"""
    model_config = {"from_attributes": True}

    id: int
    page_id: int
    layer_type: str
    layer_index: int
    visible: bool
    locked: bool
    content: Optional[Any] = None
    created_at: datetime
    updated_at: datetime


class LayerReorder(BaseModel):
    """批量调整图层顺序"""
    layer_ids: list[int] = Field(..., description="按新顺序排列的图层 ID 列表")
