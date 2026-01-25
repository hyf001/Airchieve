"""
Project Model
项目模型
"""
from datetime import datetime, timezone
from typing import TYPE_CHECKING, List

from sqlalchemy import String, DateTime, Text, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.user_query import UserQuery


class Project(Base):
    """项目表"""
    __tablename__ = "project"

    # 主键标识
    id: Mapped[str] = mapped_column(String(64), primary_key=True)

    # 关联用户
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("user.id", ondelete="CASCADE"),
        index=True,
        nullable=False
    )  # 创建者ID

    # 项目信息
    name: Mapped[str] = mapped_column(String(255), nullable=False)  # 项目名称
    description: Mapped[str | None] = mapped_column(Text, nullable=True)  # 项目描述
    status: Mapped[str] = mapped_column(String(32), default="idle", index=True)  # idle/running/stopped/error

    # 时间戳
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )  # 创建时间
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False
    )  # 更新时间
    last_active_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)  # 最后活跃时间

    # 关联关系
    user: Mapped["User"] = relationship("User", back_populates="projects")  # 所属用户
    user_queries: Mapped[List["UserQuery"]] = relationship("UserQuery", back_populates="project")  # 项目中的提问
