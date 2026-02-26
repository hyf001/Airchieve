"""
Payment Domain Models
支付领域模型

负责：微信支付订单记录（充值积分 / 订阅会员）
写入方：payment_service（创建订单、处理微信回调）

支付成功后，payment_service 负责：
  RechargeOrder    → 通知 points_service 增加积分
  SubscriptionOrder → 直接更新 User.membership_level / expire_at
"""
from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.user import MembershipLevel


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class OrderStatus(str, Enum):
    """充值订单状态"""
    pending  = "pending"   # 待支付
    paid     = "paid"      # 已支付
    failed   = "failed"    # 支付失败
    refunded = "refunded"  # 已退款


class SubscriptionStatus(str, Enum):
    """订阅订单状态"""
    pending   = "pending"    # 待支付
    active    = "active"     # 生效中
    expired   = "expired"    # 已到期
    cancelled = "cancelled"  # 已取消


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class RechargeOrder(Base):
    """
    积分充值订单

    充值比例：1 元 = 7 积分
      points_amount = amount_fen // 100 * 7

    支付成功回调流程：
      1. status → paid，回填 wechat_transaction_id、paid_at
      2. 调用 points_service.credit_recharge_points(user_id, points_amount, order_no)
    """
    __tablename__ = "recharge_orders"

    id:      Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    order_no:              Mapped[str]           = mapped_column(String(64),  unique=True,  nullable=False)
    amount_fen:            Mapped[int]           = mapped_column(Integer,     nullable=False)   # 支付金额（分）
    points_amount:         Mapped[int]           = mapped_column(Integer,     nullable=False)   # 到账积分
    status:                Mapped[str]           = mapped_column(SAEnum(OrderStatus, name="recharge_order_status"), default=OrderStatus.pending, nullable=False)
    wechat_transaction_id: Mapped[str|None]      = mapped_column(String(64),  nullable=True)
    created_at:            Mapped[datetime]      = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    paid_at:               Mapped[datetime|None] = mapped_column(DateTime, nullable=True)


class SubscriptionOrder(Base):
    """
    会员订阅订单

    套餐：lite / pro / max，按月购买。

    支付成功回调流程：
      1. status → active，回填 start_at、expire_at、wechat_transaction_id、paid_at
      2. 更新 User.membership_level 和 User.membership_expire_at
         续费：expire_at = max(当前 expire_at, now) + months 个月
         升级：expire_at = now + months 个月（重置）
    """
    __tablename__ = "subscription_orders"

    id:      Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    order_no:              Mapped[str]           = mapped_column(String(64),  unique=True,  nullable=False)
    level:                 Mapped[str]           = mapped_column(SAEnum(MembershipLevel, name="subscription_level"), nullable=False)
    months:                Mapped[int]           = mapped_column(Integer,     nullable=False)
    amount_fen:            Mapped[int]           = mapped_column(Integer,     nullable=False)
    status:                Mapped[str]           = mapped_column(SAEnum(SubscriptionStatus, name="subscription_status"), default=SubscriptionStatus.pending, nullable=False)
    wechat_transaction_id: Mapped[str|None]      = mapped_column(String(64),  nullable=True)
    start_at:              Mapped[datetime|None] = mapped_column(DateTime, nullable=True)
    expire_at:             Mapped[datetime|None] = mapped_column(DateTime, nullable=True)
    created_at:            Mapped[datetime]      = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    paid_at:               Mapped[datetime|None] = mapped_column(DateTime, nullable=True)
