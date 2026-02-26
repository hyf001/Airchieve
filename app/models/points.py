"""
Points Domain Models
积分领域模型

负责：积分流水记录
写入方：points_service（充值增加、创作扣减、管理员调整）

积分余额的真相来源是本表的流水聚合，
但 User.points_balance 存储了冗余快照用于快速读取，由 points_service 原子维护。
"""
from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class PointsLogType(str, Enum):
    """积分流水类型"""
    recharge      = "recharge"       # 微信支付充值
    creation_cost = "creation_cost"  # 绘本创作消耗
    bonus         = "bonus"          # 平台奖励（注册礼包等）
    refund        = "refund"         # 退款返还
    admin_adjust  = "admin_adjust"   # 管理员手动调整


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class UserPointsLog(Base):
    """
    积分流水表

    每次积分变动写一条记录，balance_after 是变动后的余额快照。
    related_order_id 关联充值订单号（type=recharge 时填写）。
    """
    __tablename__ = "user_points_log"

    id:      Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    delta:            Mapped[int]      = mapped_column(Integer,     nullable=False)           # 正=收入 负=支出
    type:             Mapped[str]      = mapped_column(SAEnum(PointsLogType, name="points_log_type"), nullable=False)
    description:      Mapped[str|None] = mapped_column(String(256), nullable=True)
    balance_after:    Mapped[int]      = mapped_column(Integer,     nullable=False)           # 变动后余额快照
    related_order_id: Mapped[str|None] = mapped_column(String(64),  nullable=True, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )
