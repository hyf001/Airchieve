"""
Points Service
积分领域服务

职责：
  - 创作消耗（优先消耗免费次数，再扣积分）
  - 充值增加积分（由 payment_service 在回调成功后调用）
  - 管理员调整积分
  - 查询余额 / 流水

原子性保证：
  每次积分变动在单事务内同时完成：
    1. 写 UserPointsLog 流水记录
    2. 更新 User.points_balance 快照
"""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_maker
from app.models.points import PointsLogType, UserPointsLog
from app.models.user import User


# 每次绘本创作/修改整本消耗的积分
CREATION_COST: int = 10

# 每次修改绘本单页消耗的积分
PAGE_EDIT_COST: int = 1


class InsufficientPointsError(Exception):
    """积分不足异常，供 API 层识别并返回特定错误码"""
    pass


# ---------------------------------------------------------------------------
# 内部原子操作（在已有 session 的事务中调用）
# ---------------------------------------------------------------------------

async def _apply_points_delta(
    session: AsyncSession,
    user: User,
    delta: int,
    log_type: PointsLogType,
    description: str | None = None,
    related_order_id: str | None = None,
) -> UserPointsLog:
    """
    原子修改积分：更新 User.points_balance 并写流水记录。
    调用方负责保证 session 处于事务中，且 user 已通过 with_for_update() 锁定。
    """
    user.points_balance += delta
    log = UserPointsLog(
        user_id=user.id,
        delta=delta,
        type=log_type,
        description=description,
        balance_after=user.points_balance,
        related_order_id=related_order_id,
    )
    session.add(log)
    return log


# ---------------------------------------------------------------------------
# 创作消耗
# ---------------------------------------------------------------------------

async def consume_for_creation(user_id: int) -> None:
    """
    绘本创作扣费：
      优先消耗 free_creation_remaining（免费次数），
      不足时扣 CREATION_COST 积分。

    Raises:
        ValueError: 免费次数和积分均不足
    """
    async with async_session_maker() as session:
        # with_for_update 防止并发超扣（MySQL 支持行锁，SQLite 忽略）
        user = (
            await session.execute(
                select(User).where(User.id == user_id).with_for_update()
            )
        ).scalar_one_or_none()

        if user is None:
            raise ValueError("用户不存在")

        if user.free_creation_remaining > 0:
            user.free_creation_remaining -= 1
            await session.commit()
            return

        if user.points_balance < CREATION_COST:
            raise ValueError(
                f"积分不足，创作需要 {CREATION_COST} 积分，当前余额 {user.points_balance}"
            )

        await _apply_points_delta(
            session, user,
            delta=-CREATION_COST,
            log_type=PointsLogType.creation_cost,
            description="绘本创作消耗",
        )
        await session.commit()


# ---------------------------------------------------------------------------
# 创作/编辑前积分检查（仅检查，不扣费）
# ---------------------------------------------------------------------------

async def check_creation_points(user_id: int) -> None:
    """
    检查用户是否有足够的创作/修改整本积分（仅检查，不扣费）。
    优先看免费次数，再看积分余额。

    Raises:
        InsufficientPointsError: 免费次数和积分均不足
    """
    async with async_session_maker() as session:
        user = (
            await session.execute(select(User).where(User.id == user_id))
        ).scalar_one_or_none()

        if user is None:
            raise ValueError("用户不存在")

        if user.free_creation_remaining > 0:
            return

        if user.points_balance < CREATION_COST:
            raise InsufficientPointsError(
                f"积分不足，创作需要 {CREATION_COST} 积分，当前余额 {user.points_balance}"
            )


async def check_page_edit_points(user_id: int) -> None:
    """
    检查用户是否有足够的单页编辑积分（仅检查，不扣费）。

    Raises:
        InsufficientPointsError: 积分不足
    """
    async with async_session_maker() as session:
        user = (
            await session.execute(select(User).where(User.id == user_id))
        ).scalar_one_or_none()

        if user is None:
            raise ValueError("用户不存在")

        if user.points_balance < PAGE_EDIT_COST:
            raise InsufficientPointsError(
                f"积分不足，单页编辑需要 {PAGE_EDIT_COST} 积分，当前余额 {user.points_balance}"
            )


# ---------------------------------------------------------------------------
# 单页编辑消耗
# ---------------------------------------------------------------------------

async def consume_for_page_edit(user_id: int) -> None:
    """
    绘本单页编辑扣费：消耗 PAGE_EDIT_COST 积分。

    Raises:
        ValueError: 积分不足
    """
    async with async_session_maker() as session:
        user = (
            await session.execute(
                select(User).where(User.id == user_id).with_for_update()
            )
        ).scalar_one_or_none()

        if user is None:
            raise ValueError("用户不存在")

        if user.points_balance < PAGE_EDIT_COST:
            raise ValueError(
                f"积分不足，单页编辑需要 {PAGE_EDIT_COST} 积分，当前余额 {user.points_balance}"
            )

        await _apply_points_delta(
            session, user,
            delta=-PAGE_EDIT_COST,
            log_type=PointsLogType.creation_cost,
            description="绘本单页编辑消耗",
        )
        await session.commit()


# ---------------------------------------------------------------------------
# 充值（由 payment_service 调用）
# ---------------------------------------------------------------------------

async def credit_recharge_points(user_id: int, points: int, order_no: str) -> None:
    """
    充值成功后增加积分（由 payment_service 在回调事务中调用）。

    Args:
        user_id:  用户 ID
        points:   到账积分数
        order_no: 充值订单号，用于流水关联
    """
    async with async_session_maker() as session:
        user = (
            await session.execute(
                select(User).where(User.id == user_id).with_for_update()
            )
        ).scalar_one_or_none()

        if user is None:
            raise ValueError("用户不存在")

        await _apply_points_delta(
            session, user,
            delta=points,
            log_type=PointsLogType.recharge,
            description=f"微信支付充值，订单号 {order_no}",
            related_order_id=order_no,
        )
        await session.commit()


# ---------------------------------------------------------------------------
# 管理员调整
# ---------------------------------------------------------------------------

async def admin_adjust_points(user_id: int, delta: int, description: str) -> None:
    """
    管理员手动增减积分（delta 可正可负）。

    Raises:
        ValueError: 扣减后余额为负
    """
    async with async_session_maker() as session:
        user = (
            await session.execute(
                select(User).where(User.id == user_id).with_for_update()
            )
        ).scalar_one_or_none()

        if user is None:
            raise ValueError("用户不存在")

        if user.points_balance + delta < 0:
            raise ValueError(
                f"调整后余额将为负数（当前 {user.points_balance}，调整 {delta}）"
            )

        await _apply_points_delta(
            session, user,
            delta=delta,
            log_type=PointsLogType.admin_adjust,
            description=description,
        )
        await session.commit()


# ---------------------------------------------------------------------------
# 查询
# ---------------------------------------------------------------------------

async def get_balance(user_id: int) -> int:
    """查询积分余额"""
    async with async_session_maker() as session:
        user = (
            await session.execute(select(User).where(User.id == user_id))
        ).scalar_one_or_none()
        return user.points_balance if user else 0


async def get_points_history(
    user_id: int,
    limit: int = 20,
    offset: int = 0,
) -> list[UserPointsLog]:
    """积分流水分页查询（按时间倒序）"""
    from sqlalchemy import desc

    async with async_session_maker() as session:
        rows = (
            await session.execute(
                select(UserPointsLog)
                .where(UserPointsLog.user_id == user_id)
                .order_by(desc(UserPointsLog.created_at))
                .limit(limit)
                .offset(offset)
            )
        ).scalars().all()
        return list(rows)
