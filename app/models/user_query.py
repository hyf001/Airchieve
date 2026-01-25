"""
User Query Model
用户问句模型
"""
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import String, DateTime, ForeignKey, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.projects import Project


class UserQuery(Base):
    """用户问句表"""
    __tablename__ = "user_query"

    # 主键标识
    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # query_id

    # 关联实体
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("user.id", ondelete="CASCADE"),
        index=True,
        nullable=False
    )  # 提问用户ID
    project_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("project.id", ondelete="CASCADE"),
        index=True,
        nullable=False
    )  # 所属项目ID

    # 问句信息
    content: Mapped[str] = mapped_column(Text, nullable=False)  # 用户问句内容

    # 时间戳
    created_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)  # 创建时间
    answered_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)  # 回答时间

    # 关联关系
    user: Mapped["User"] = relationship("User", back_populates="user_queries")  # 提问用户
    project: Mapped["Project"] = relationship("Project", back_populates="user_queries")  # 所属项目
