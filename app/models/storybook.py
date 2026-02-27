"""
Book Model
绘本模型
"""
import json
from datetime import datetime, timezone
from typing import TYPE_CHECKING, TypedDict, Literal

from sqlalchemy import Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from app.db.base import Base


class JsonText(TypeDecorator):
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


__all__ = ["Storybook", "StorybookPage", "StorybookStatus"]


# Storybook 状态字面量类型
StorybookStatus = Literal["init", "creating", "updating", "finished", "error"]


class StorybookPage(TypedDict):
    text:str
    image_url:str

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

    # 页面内容（JSON格式存储多个页面）
    pages: Mapped[list[StorybookPage] | None] = mapped_column(JsonText, nullable=True)  # 页面列表

    # 绘本状态: init-初始化, creating-生成中, updating-更新中, finished-完成, error-错误
    status: Mapped[StorybookStatus] = mapped_column(String(32), default="init", index=True)

    # 时间戳
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )  # 创建时间
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False
    )  # 更新时间


