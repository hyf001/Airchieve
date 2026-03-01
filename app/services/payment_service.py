"""
Payment Service
支付领域服务

职责：
  - 创建充值订单 / 订阅订单
  - 处理微信支付回调（充值 / 订阅）
  - 订单查询

积分比例：1 元 = 7 积分（POINTS_PER_YUAN）

充值回调链路：
  handle_recharge_paid()
    → 更新 RechargeOrder.status = paid
    → 调用 points_service.credit_recharge_points()

订阅回调链路：
  handle_subscription_paid()
    → 更新 SubscriptionOrder.status = active，设置 start_at / expire_at
    → 更新 User.membership_level / membership_expire_at
      续费同级：expire_at = max(当前到期, now) + months
      升级/降级：expire_at = now + months（重置）
"""
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import select

from app.db.session import async_session_maker
from app.models.payment import OrderStatus, RechargeOrder, SubscriptionOrder, SubscriptionStatus
from app.models.user import MembershipLevel, User
from app.services import points_service


# 充值积分换算比例：1 元 = 3 积分
POINTS_PER_YUAN: int = 3


# ---------------------------------------------------------------------------
# 工具
# ---------------------------------------------------------------------------

def _gen_order_no(prefix: str) -> str:
    """生成唯一订单号，格式：{prefix}{YYYYMMDDHHmmss}{6位随机}，总长 ≤ 32"""
    now = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    rand = uuid.uuid4().hex[:6].upper()
    return f"{prefix}{now}{rand}"


def _add_months(dt: datetime, months: int) -> datetime:
    """向 datetime 加 n 个月（每月按 30 天计）"""
    return dt + timedelta(days=30 * months)


def _calc_points(amount_fen: int) -> int:
    """分 → 积分：amount_fen / 100 * POINTS_PER_YUAN（向下取整）"""
    return (amount_fen // 100) * POINTS_PER_YUAN


# ---------------------------------------------------------------------------
# 充值订单
# ---------------------------------------------------------------------------

async def create_recharge_order(user_id: int, amount_fen: int) -> RechargeOrder:
    """
    创建积分充值订单

    Args:
        user_id:    用户 ID
        amount_fen: 支付金额（分），如 100 = 1 元

    Returns:
        RechargeOrder（status=pending），将 order_no 传给前端发起微信支付
    """
    if amount_fen <= 0:
        raise ValueError("支付金额必须大于 0")

    points_amount = _calc_points(amount_fen)
    order_no = _gen_order_no("RC")

    async with async_session_maker() as session:
        order = RechargeOrder(
            user_id=user_id,
            order_no=order_no,
            amount_fen=amount_fen,
            points_amount=points_amount,
        )
        session.add(order)
        await session.commit()
        await session.refresh(order)
        return order


async def handle_recharge_paid(order_no: str, wechat_transaction_id: str) -> None:
    """
    充值订单支付成功回调

    由微信支付回调接口调用。完成后积分实时到账。

    Raises:
        ValueError: 订单不存在 / 订单已处理 / 用户不存在
    """
    async with async_session_maker() as session:
        order = (
            await session.execute(
                select(RechargeOrder).where(RechargeOrder.order_no == order_no)
            )
        ).scalar_one_or_none()

        if order is None:
            raise ValueError(f"充值订单不存在：{order_no}")
        if order.status != OrderStatus.pending:
            raise ValueError(f"订单已处理（当前状态：{order.status}），忽略重复回调")

        order.status = OrderStatus.paid
        order.wechat_transaction_id = wechat_transaction_id
        order.paid_at = datetime.now(timezone.utc)
        await session.commit()

    # 跨域调用：通知积分服务增加积分（各自独立事务，保持幂等）
    await points_service.credit_recharge_points(
        user_id=order.user_id,
        points=order.points_amount,
        order_no=order_no,
    )


# ---------------------------------------------------------------------------
# 订阅订单
# ---------------------------------------------------------------------------

async def create_subscription_order(
    user_id: int,
    level: MembershipLevel,
    months: int,
    amount_fen: int,
) -> SubscriptionOrder:
    """
    创建会员订阅订单

    Args:
        user_id:    用户 ID
        level:      订阅等级（lite / pro / max）
        months:     购买月数
        amount_fen: 支付金额（分）

    Returns:
        SubscriptionOrder（status=pending）
    """
    if level == MembershipLevel.free:
        raise ValueError("不能订阅 free 套餐")
    if months <= 0:
        raise ValueError("购买月数必须大于 0")
    if amount_fen <= 0:
        raise ValueError("支付金额必须大于 0")

    order_no = _gen_order_no("SUB")

    async with async_session_maker() as session:
        order = SubscriptionOrder(
            user_id=user_id,
            order_no=order_no,
            level=level,
            months=months,
            amount_fen=amount_fen,
        )
        session.add(order)
        await session.commit()
        await session.refresh(order)
        return order


async def handle_subscription_paid(order_no: str, wechat_transaction_id: str) -> None:
    """
    订阅订单支付成功回调

    续费同级：在现有到期时间基础上延长。
    升级/降级：从当前时间重新计算，覆盖旧套餐。

    Raises:
        ValueError: 订单不存在 / 订单已处理 / 用户不存在
    """
    async with async_session_maker() as session:
        order = (
            await session.execute(
                select(SubscriptionOrder).where(SubscriptionOrder.order_no == order_no)
            )
        ).scalar_one_or_none()

        if order is None:
            raise ValueError(f"订阅订单不存在：{order_no}")
        if order.status != SubscriptionStatus.pending:
            raise ValueError(f"订单已处理（当前状态：{order.status}），忽略重复回调")

        user = (
            await session.execute(
                select(User).where(User.id == order.user_id)
            )
        ).scalar_one_or_none()

        if user is None:
            raise ValueError(f"用户不存在：{order.user_id}")

        now = datetime.now(timezone.utc)
        is_renewal = (
            user.membership_level == order.level
            and user.membership_expire_at is not None
            and user.membership_expire_at > now
        )

        if is_renewal:
            # 续费同级：在原到期时间上追加
            base = user.membership_expire_at
        else:
            # 升级/降级/首次订阅：从现在开始
            base = now

        new_expire = _add_months(base, order.months)

        # 更新订单
        order.status = SubscriptionStatus.active
        order.wechat_transaction_id = wechat_transaction_id
        order.start_at = now
        order.expire_at = new_expire
        order.paid_at = now

        # 更新用户会员状态（支付域写入缓存字段）
        user.membership_level = order.level
        user.membership_expire_at = new_expire

        await session.commit()


async def admin_set_membership(
    user_id: int,
    level: str,
    expire_at: datetime | None,
) -> None:
    """管理员直接设置用户会员等级和到期时间"""
    async with async_session_maker() as session:
        user = (
            await session.execute(
                select(User).where(User.id == user_id).with_for_update()
            )
        ).scalar_one_or_none()

        if user is None:
            raise ValueError("用户不存在")

        user.membership_level = level
        user.membership_expire_at = expire_at
        await session.commit()


# ---------------------------------------------------------------------------
# 查询
# ---------------------------------------------------------------------------

async def get_recharge_order(order_no: str) -> RechargeOrder | None:
    """按订单号查询充值订单"""
    async with async_session_maker() as session:
        return (
            await session.execute(
                select(RechargeOrder).where(RechargeOrder.order_no == order_no)
            )
        ).scalar_one_or_none()


async def get_subscription_order(order_no: str) -> SubscriptionOrder | None:
    """按订单号查询订阅订单"""
    async with async_session_maker() as session:
        return (
            await session.execute(
                select(SubscriptionOrder).where(SubscriptionOrder.order_no == order_no)
            )
        ).scalar_one_or_none()


async def get_user_subscription_orders(
    user_id: int,
    limit: int = 20,
    offset: int = 0,
) -> list[SubscriptionOrder]:
    """查询用户的订阅订单历史（按时间倒序）"""
    from sqlalchemy import desc

    async with async_session_maker() as session:
        rows = (
            await session.execute(
                select(SubscriptionOrder)
                .where(SubscriptionOrder.user_id == user_id)
                .order_by(desc(SubscriptionOrder.created_at))
                .limit(limit)
                .offset(offset)
            )
        ).scalars().all()
        return list(rows)


async def get_user_recharge_orders(
    user_id: int,
    limit: int = 20,
    offset: int = 0,
) -> list[RechargeOrder]:
    """查询用户的充值订单历史（按时间倒序）"""
    from sqlalchemy import desc

    async with async_session_maker() as session:
        rows = (
            await session.execute(
                select(RechargeOrder)
                .where(RechargeOrder.user_id == user_id)
                .order_by(desc(RechargeOrder.created_at))
                .limit(limit)
                .offset(offset)
            )
        ).scalars().all()
        return list(rows)
