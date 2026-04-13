"""
Page Model
页面模型（从 Storybook.pages JSON 中独立）
"""
import json
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional, TypedDict

from enum import Enum
from pydantic import BaseModel
from sqlalchemy import Integer, String, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from app.db.base import Base
from app.models.enums import PageType

if TYPE_CHECKING:
    from app.models.storybook import Storybook


__all__ = ["Page", "Storyboard", "JsonText"]


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
            return json.loads(value)
        return value


class Storyboard(TypedDict):
    scene: str       # 场景环境
    characters: str  # 人物与动作
    shot: str        # 景别构图
    color: str       # 色调氛围
    lighting: str    # 光线


class Page(Base):
    """页面表 — 每个绘本页面独立存储，支持图层管理"""
    __tablename__ = "pages"
    __table_args__ = (
        UniqueConstraint("storybook_id", "page_index", name="uq_storybook_page_index"),
    )

    # 主键
    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    # 所属绘本
    storybook_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("storybooks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    storybook: Mapped["Storybook"] = relationship("Storybook", back_populates="pages")

    # 页面顺序（从 0 开始）
    page_index: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    # AI 生成的原图（永不覆盖）
    image_url: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    # 故事文字
    text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="",
    )

    # 页面类型：cover / content / back_cover
    page_type: Mapped[PageType] = mapped_column(
        String(32),
        default=PageType.CONTENT,
        nullable=False,
    )

    # 分镜信息（JSON，结构与 Storybook.Storyboard 一致）
    storyboard: Mapped[Optional[Storyboard]] = mapped_column(
        JsonText,
        nullable=True,
    )

    # 时间戳
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
