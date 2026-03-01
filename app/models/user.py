"""
Identity Domain Models
用户身份领域模型

负责：用户核心身份信息 + 多种登录方式的凭证管理
写入方：user_service（注册、登录、改资料）

跨域缓存字段（由对应域的 service 负责写入，只读不写）：
  points_balance          ← points_service
  free_creation_remaining ← points_service
  membership_level        ← payment_service
  membership_expire_at    ← payment_service
"""
from datetime import datetime, timezone
from enum import Enum
from typing import List

from sqlalchemy import Boolean, DateTime, Enum as SAEnum, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class UserRole(str, Enum):
    """用户角色"""
    admin = "admin"
    user  = "user"


class UserStatus(str, Enum):
    """账号状态"""
    active  = "active"
    banned  = "banned"
    deleted = "deleted"


class AuthType(str, Enum):
    """登录凭证类型"""
    password   = "password"    # 账号 + 密码
    sms        = "sms"         # 手机号（验证码在缓存层校验，不持久化）
    wechat_web = "wechat_web"  # 微信网页扫码授权（openid）


class MembershipLevel(str, Enum):
    """会员等级（订阅制：lite / pro / max，按月）"""
    free = "free"
    lite = "lite"
    pro  = "pro"
    max  = "max"


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class User(Base):
    """
    用户主表 —— 身份域聚合根

    只有本域的字段（nickname / avatar_url / role / status）由 user_service 写。
    points_balance、membership_level 等是其他域写入的缓存，本表只读。
    """
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # 基础信息（身份域自有）
    nickname:   Mapped[str]      = mapped_column(String(64),  nullable=False)
    avatar_url: Mapped[str|None] = mapped_column(String(512), nullable=True)
    role:       Mapped[str]      = mapped_column(SAEnum(UserRole,   name="user_role"),   default=UserRole.user,        nullable=False)
    status:     Mapped[str]      = mapped_column(SAEnum(UserStatus, name="user_status"), default=UserStatus.active,    nullable=False)

    # 积分域缓存（points_service 负责写）
    points_balance:          Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    free_creation_remaining: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # 支付域缓存（payment_service 负责写）
    membership_level:     Mapped[str]          = mapped_column(SAEnum(MembershipLevel, name="membership_level"), default=MembershipLevel.free, nullable=False)
    membership_expire_at: Mapped[datetime|None] = mapped_column(DateTime, nullable=True)

    # 时间戳
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # 关联（仅身份域内部）
    auth_records: Mapped[List["UserAuth"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class UserAuth(Base):
    """
    认证凭证表

    (auth_type, identifier) 联合唯一，是所有登录方式的统一查询入口：
      password   → identifier = 账号名,   credential = bcrypt 哈希
      sms        → identifier = 手机号,   credential = null
      wechat_web → identifier = openid,  credential = null，wechat_unionid 可选存
    """
    __tablename__ = "user_auth"
    __table_args__ = (
        UniqueConstraint("auth_type", "identifier", name="uq_auth_type_identifier"),
    )

    id:      Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    auth_type:      Mapped[str]      = mapped_column(SAEnum(AuthType, name="auth_type"), nullable=False)
    identifier:     Mapped[str]      = mapped_column(String(128), nullable=False, index=True)
    credential:     Mapped[str|None] = mapped_column(String(255), nullable=True)   # 密码哈希
    wechat_unionid: Mapped[str|None] = mapped_column(String(64),  nullable=True)   # 微信 unionid
    is_active:      Mapped[bool]     = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    user: Mapped["User"] = relationship(back_populates="auth_records")
