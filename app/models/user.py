"""
User Model
用户信息模型
"""
from datetime import datetime, timezone
from typing import TYPE_CHECKING, List

from sqlalchemy import String, DateTime, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    """用户信息表"""
    __tablename__ = "user"

    # 主键标识
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # 账户信息
    account: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)  # 账户名
    password: Mapped[str] = mapped_column(String(255), nullable=False)  # 密码
    name: Mapped[str] = mapped_column(String(128), nullable=False)  # 用户名称
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)  # 邮箱
    phone_num: Mapped[str | None] = mapped_column(String(32), nullable=True)  # 手机号

    # 用户配置
    settings: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # 用户设置

    # 角色与等级
    role: Mapped[str] = mapped_column(String(32), default="visitor", nullable=False)  # admin/visitor/register/vip
    vip_level: Mapped[int] = mapped_column(Integer, default=0, nullable=False)  # VIP等级

    # 时间戳
    regist_time: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )  # 注册时间
    last_login_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)  # 最后登录时间