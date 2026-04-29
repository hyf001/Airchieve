"""
Page Model
页面模型（从 Storybook.pages JSON 中独立）
"""
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Integer, String, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, JsonText
from app.models.enums import PageStatus, PageType
from app.schemas.storyboard import Storyboard

if TYPE_CHECKING:
    from app.models.storybook import Storybook


__all__ = ["Page", "Storyboard", "JsonText"]


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

    # 页面生成状态：pending / generating / finished / error
    status: Mapped[PageStatus] = mapped_column(
        String(32),
        default=PageStatus.PENDING,
        nullable=False,
        index=True,
    )

    # 页面级错误信息（status=error 时展示，可单页重试）
    error_message: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
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
