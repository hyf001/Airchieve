"""
Book Model
绘本模型
"""
import json
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Literal, Optional, TypedDict

from enum import Enum
from pydantic import BaseModel
from sqlalchemy import Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from app.db.base import Base
from app.models.enums import CliType, AspectRatio, ImageSize, PageType


class JsonText(TypeDecorator):
    """以 Text 存储 JSON，兼容低版本 MariaDB"""
    impl = Text
    cache_ok = True

    @staticmethod
    def _to_jsonable(value):
        if isinstance(value, BaseModel):
            if hasattr(value, "model_dump"):
                return JsonText._to_jsonable(value.model_dump(mode="json"))
            return JsonText._to_jsonable(value.dict())
        if isinstance(value, Enum):
            return value.value
        if isinstance(value, list):
            return [JsonText._to_jsonable(v) for v in value]
        if isinstance(value, dict):
            return {k: JsonText._to_jsonable(v) for k, v in value.items()}
        return value

    def process_bind_param(self, value, dialect):
        if value is not None:
            return json.dumps(self._to_jsonable(value), ensure_ascii=False)
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            data = json.loads(value)
            if isinstance(data, list):
                converted = []
                for item in data:
                    if isinstance(item, dict):
                        try:
                            converted.append(StorybookPage(**item))
                            continue
                        except Exception:
                            pass
                    converted.append(item)
                return converted
            return data
        return value


__all__ = ["Storybook", "StorybookPage", "StorybookStatus", "Storyboard"]


# Storybook 状态字面量类型
StorybookStatus = Literal["init", "creating", "updating", "finished", "error", "terminated"]


class Storyboard(TypedDict):
    scene: str       # 场景环境
    characters: str  # 人物与动作
    shot: str        # 景别构图
    color: str       # 色调氛围
    lighting: str    # 光线


class StorybookPage(BaseModel):
    text: str
    image_url: str
    storyboard: Optional[Storyboard] = None
    page_type: PageType = PageType.CONTENT  # 页面类型：封面、封底、内页，默认内页

class Storybook(Base):
    """绘本表"""
    __tablename__ = "storybooks"

    # 主键标识 - SQLite 自增配置
    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    # 绘本信息
    title: Mapped[str] = mapped_column(String(255), nullable=False)  # 绘本标题
    description: Mapped[str | None] = mapped_column(Text, nullable=True)  # 绘本描述
    creator: Mapped[str] = mapped_column(String(128), nullable=False)  # 创建者名称

    # 用户输入和模版
    instruction: Mapped[str | None] = mapped_column(Text, nullable=True)  # 用户问句/指令
    template_id: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 模版ID
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # 是否公开

    # CLI 配置
    cli_type: Mapped[CliType] = mapped_column(String(32), default=CliType.GEMINI, nullable=False)  # CLI类型
    aspect_ratio: Mapped[AspectRatio] = mapped_column(String(16), default=AspectRatio.RATIO_16_9, nullable=False)  # 图片比例
    image_size: Mapped[ImageSize] = mapped_column(String(8), default=ImageSize.SIZE_1K, nullable=False)  # 图片尺寸

    # 页面内容（JSON格式存储多个页面）
    pages: Mapped[list[StorybookPage] | None] = mapped_column(JsonText, nullable=True)  # 页面列表

    # 绘本状态: init-初始化, creating-生成中, updating-更新中, finished-完成, error-错误
    status: Mapped[StorybookStatus] = mapped_column(String(32), default="init", index=True)
    error_message: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # 错误信息（status=error时）

    # 时间戳
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )  # 创建时间
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False
    )  # 更新时间

