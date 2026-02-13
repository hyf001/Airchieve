"""
Template Model
模板模型 - 用于生成绘本的模板配置
"""
from datetime import datetime, timezone

from sqlalchemy import Integer, String, DateTime, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


__all__ = ["Template"]


class Template(Base):
    """绘本生成模板表"""
    __tablename__ = "templates"

    # 主键标识 - SQLite 自增配置
    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    # 模板信息
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)  # 模板名称
    description: Mapped[str | None] = mapped_column(Text, nullable=True)  # 模板描述
    creator: Mapped[str] = mapped_column(String(128), nullable=False)  # 创建者名称
    modifier: Mapped[str | None] = mapped_column(String(128), nullable=True)  # 修改者名称

    # 生成配置
    instruction: Mapped[str] = mapped_column(Text, nullable=False)  # 用户指令模板
    systemprompt: Mapped[str | None] = mapped_column(Text, nullable=True)  # 系统提示词

    # 示例绘本（可选）
    storybook_id: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 关联的示例绘本ID

    # 模板状态
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)  # 是否启用
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)  # 排序顺序

    # 时间戳
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )  # 创建时间
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False
    )  # 更新时间
