"""
Layer Model
图层模型 — 文字、绘画、插入图片等作为独立图层持久化
"""
import json
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import Integer, String, DateTime, ForeignKey, Text, Boolean, Index
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import TypeDecorator

from app.db.base import Base
from app.models.enums import LayerType


__all__ = ["Layer"]


class JsonColumn(TypeDecorator):
    """以 Text 存储 JSON，兼容低版本 MariaDB"""
    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None:
            return json.dumps(value, ensure_ascii=False)
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            return json.loads(value)
        return value


class Layer(Base):
    """图层表 — 每个编辑操作（文字/绘画/插入图片）作为独立图层存储"""
    __tablename__ = "layers"
    __table_args__ = (
        Index("ix_layers_page_index", "page_id", "layer_index"),
    )

    # 主键
    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    # 所属页面
    page_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("pages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # 图层类型：text / draw / image / sticker / adjustment
    layer_type: Mapped[LayerType] = mapped_column(
        String(32),
        nullable=False,
    )

    # 渲染顺序（越小越靠底）
    layer_index: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    # 是否可见
    visible: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    # 是否锁定
    locked: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    # 图层数据（JSON，结构由 layer_type 决定，在 schema/service 层校验）
    content: Mapped[Optional[Any]] = mapped_column(
        JsonColumn,
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
