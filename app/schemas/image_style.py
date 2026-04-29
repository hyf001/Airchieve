"""
Image Style Schemas
图片风格相关的 Pydantic 请求/响应模型
"""
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class ImageStyleAssetBase(BaseModel):
    """风格图片资产可编辑字段"""

    name: Optional[str] = Field(None, max_length=255, description="图片名称")
    description: Optional[str] = Field(None, description="图片描述")
    tags: list[str] = Field(default_factory=list, description="通用标签")
    style_type: Optional[str] = Field(None, max_length=64, description="风格类型")
    color_tags: list[str] = Field(default_factory=list, description="色彩标签")
    texture_tags: list[str] = Field(default_factory=list, description="笔触材质标签")
    scene_tags: list[str] = Field(default_factory=list, description="场景标签")
    subject_tags: list[str] = Field(default_factory=list, description="主体标签")
    composition_tags: list[str] = Field(default_factory=list, description="构图标签")
    age_group_tags: list[str] = Field(default_factory=list, description="年龄段标签")


class ImageStyleAssetUpdate(BaseModel):
    """更新风格图片资产请求"""

    name: Optional[str] = Field(None, min_length=1, max_length=255, description="图片名称")
    description: Optional[str] = Field(None, description="图片描述")
    tags: Optional[list[str]] = Field(None, description="通用标签")
    style_type: Optional[str] = Field(None, max_length=64, description="风格类型")
    color_tags: Optional[list[str]] = Field(None, description="色彩标签")
    texture_tags: Optional[list[str]] = Field(None, description="笔触材质标签")
    scene_tags: Optional[list[str]] = Field(None, description="场景标签")
    subject_tags: Optional[list[str]] = Field(None, description="主体标签")
    composition_tags: Optional[list[str]] = Field(None, description="构图标签")
    age_group_tags: Optional[list[str]] = Field(None, description="年龄段标签")
    is_active: Optional[bool] = Field(None, description="是否启用")


class ImageStyleAssetResponse(ImageStyleAssetBase):
    """风格图片资产响应"""
    model_config = {"from_attributes": True}

    id: int
    url: str
    object_key: str
    name: str
    content_type: str
    file_size: int
    width: Optional[int]
    height: Optional[int]
    is_active: bool
    reference_count: int = 0
    creator: str
    modifier: Optional[str]
    created_at: datetime
    updated_at: datetime


class ReferenceImageBase(BaseModel):
    """图片风格参考图基础字段"""

    asset_id: int = Field(..., description="图片资产 ID")
    is_cover: bool = Field(False, description="是否封面图")
    sort_order: Optional[int] = Field(None, description="排序")
    note: Optional[str] = Field(None, max_length=500, description="图片备注")


class ReferenceImageCreate(ReferenceImageBase):
    """创建图片风格参考图请求"""


class ReferenceImageUpdate(BaseModel):
    """更新图片风格参考图请求"""

    is_cover: Optional[bool] = Field(None, description="是否封面图")
    sort_order: Optional[int] = Field(None, description="排序")
    note: Optional[str] = Field(None, max_length=500, description="图片备注")


class ReferenceImageResponse(BaseModel):
    """图片风格参考图响应"""
    model_config = {"from_attributes": True}

    id: int
    image_style_version_id: int
    asset_id: Optional[int]
    url: str
    url_snapshot: Optional[str]
    is_cover: bool
    sort_order: int
    note: Optional[str]
    creator: str
    created_at: datetime
    updated_at: datetime


class ImageStyleListItem(BaseModel):
    """可用图片风格列表项"""
    model_config = {"from_attributes": True}

    id: int
    name: str
    description: Optional[str]
    cover_image: Optional[str]
    tags: list[str]
    current_version_id: Optional[int]
    current_version_no: Optional[str]
    is_active: bool = True
    updated_at: Optional[datetime] = None
    sort_order: int


class ImageStyleResponse(BaseModel):
    """图片风格详情响应"""
    model_config = {"from_attributes": True}

    id: int
    name: str
    description: Optional[str]
    cover_image: Optional[str]
    tags: list[str]
    current_version_id: Optional[int]
    current_version_no: Optional[str] = None
    is_active: bool
    sort_order: int
    creator: str
    modifier: Optional[str]
    created_at: datetime
    updated_at: datetime


class ImageStyleVersionResponse(BaseModel):
    """图片风格版本响应"""
    model_config = {"from_attributes": True}

    id: int
    image_style_id: int
    version_no: str
    generation_prompt: Optional[str]
    negative_prompt: Optional[str]
    reference_images: list[ReferenceImageResponse]
    status: Literal["draft", "published"]
    creator: str
    created_at: datetime
    published_at: Optional[datetime]


class CreateImageStyleRequest(BaseModel):
    """创建图片风格请求"""

    name: str = Field(..., min_length=1, max_length=255, description="风格名称")
    description: Optional[str] = Field(None, description="风格描述")
    cover_image: Optional[str] = Field(None, max_length=1024, description="封面图")
    tags: list[str] = Field(default_factory=list, description="标签")
    is_active: bool = Field(True, description="是否启用")
    sort_order: int = Field(0, description="排序权重")


class UpdateImageStyleRequest(BaseModel):
    """更新图片风格基础信息请求"""

    name: Optional[str] = Field(None, min_length=1, max_length=255, description="风格名称")
    description: Optional[str] = Field(None, description="风格描述")
    cover_image: Optional[str] = Field(None, max_length=1024, description="封面图")
    tags: Optional[list[str]] = Field(None, description="标签")
    is_active: Optional[bool] = Field(None, description="是否启用")
    sort_order: Optional[int] = Field(None, description="排序权重")


class CreateImageStyleVersionRequest(BaseModel):
    """创建图片风格版本草稿请求"""

    generation_prompt: Optional[str] = Field(None, description="生成提示词")
    negative_prompt: Optional[str] = Field(None, description="负面提示词")
    reference_images: list[ReferenceImageCreate] = Field(default_factory=list, description="初始参考图列表")


class UpdateImageStyleVersionRequest(BaseModel):
    """更新图片风格版本草稿请求"""

    generation_prompt: Optional[str] = Field(None, description="生成提示词")
    negative_prompt: Optional[str] = Field(None, description="负面提示词")
