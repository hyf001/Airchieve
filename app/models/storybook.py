"""
Book Model
绘本模型
"""
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Literal, Optional

from sqlalchemy import Integer, String, DateTime, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import CliType, AspectRatio, ImageSize

if TYPE_CHECKING:
    from app.models.page import Page


__all__ = ["Storybook", "StorybookStatus"]


# Storybook 状态字面量类型
StorybookStatus = Literal["init", "creating", "updating", "finished", "error", "terminated"]


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

    # 页面列表（通过 Page 表关联，按 page_index 排序）
    pages: Mapped[list["Page"]] = relationship(
        "Page",
        back_populates="storybook",
        order_by="Page.page_index",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

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
