import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.model.audit import AuditOperatorType
from app.model.payment import (
    PaymentEventType,
    PaymentOrder,
    PaymentOrderStatus,
    PaymentProvider,
    PaymentRecord,
    RefundRecord,
    RefundStatus,
)
from app.schema.audit import AuditLogCreateInternal, AuditSnapshot
from app.model.membership import MembershipPlanStatus
from app.schema.membership import SubscriptionChangePayload
from app.schema.payment import (
    CreateMembershipOrderRequest,
    PaymentCallbackPayload,
    PaymentCallbackResult,
    PaymentOrderRead,
    PaymentParams,
    PaymentRecordRead,
    RefundCreate,
    RefundRecordRead,
)
from app.service import audit as audit_service, membership as membership_service


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _order_no() -> str:
    return f"MO{_now().strftime('%Y%m%d%H%M%S')}{secrets.token_hex(4).upper()}"


def _refund_no() -> str:
    return f"RF{_now().strftime('%Y%m%d%H%M%S')}{secrets.token_hex(4).upper()}"


def _read_order(order: PaymentOrder, include_params: bool = False) -> PaymentOrderRead:
    params = None
    if include_params and order.status == PaymentOrderStatus.PENDING:
        params = PaymentParams(
            provider=order.provider,
            order_no=order.order_no,
            amount_cents=order.amount_cents,
            currency=order.currency,
            nonce=secrets.token_urlsafe(16),
        )
    return PaymentOrderRead(
        id=order.id,
        order_no=order.order_no,
        user_id=order.user_id,
        plan_id=order.plan_id,
        amount_cents=order.amount_cents,
        currency=order.currency,
        provider=order.provider,
        status=order.status,
        provider_order_id=order.provider_order_id,
        payment_params=params,
        paid_at=order.paid_at,
        expired_at=order.expired_at,
        created_at=order.created_at,
        updated_at=order.updated_at,
    )


async def _find_order(db: AsyncSession, order_no: str) -> PaymentOrder | None:
    result = await db.execute(select(PaymentOrder).where(PaymentOrder.order_no == order_no))
    return result.scalar_one_or_none()


def _period_end(start: datetime, billing_period: str) -> datetime:
    match billing_period:
        case "month":
            return start + timedelta(days=30)
        case "quarter":
            return start + timedelta(days=90)
        case "year":
            return start + timedelta(days=365)
        case _:
            return start


async def create_membership_order(
    db: AsyncSession,
    user_id: int,
    payload: CreateMembershipOrderRequest,
) -> PaymentOrderRead:
    if payload.idempotency_key:
        existing = await db.execute(
            select(PaymentOrder).where(
                PaymentOrder.user_id == user_id,
                PaymentOrder.idempotency_key == payload.idempotency_key,
            )
        )
        order = existing.scalar_one_or_none()
        if order is not None:
            return _read_order(order, include_params=True)
    plan = await membership_service.get_membership_plan(db, payload.plan_id)
    if plan.status != MembershipPlanStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="会员计划未启用")
    order = PaymentOrder(
        order_no=_order_no(),
        user_id=user_id,
        plan_id=plan.id,
        amount_cents=plan.price_cents,
        currency=plan.currency,
        provider=payload.provider,
        status=PaymentOrderStatus.PENDING,
        expired_at=_now() + timedelta(minutes=30),
        idempotency_key=payload.idempotency_key,
        return_url=payload.return_url,
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return _read_order(order, include_params=True)


async def get_payment_order(db: AsyncSession, user_id: int, order_id: int) -> PaymentOrderRead:
    order = await db.get(PaymentOrder, order_id)
    if order is None or order.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="支付订单不存在")
    return _read_order(order)


async def list_user_payment_records(db: AsyncSession, user_id: int) -> list[PaymentRecordRead]:
    result = await db.execute(
        select(PaymentRecord, PaymentOrder)
        .join(PaymentOrder, PaymentRecord.order_id == PaymentOrder.id)
        .where(PaymentOrder.user_id == user_id)
        .order_by(PaymentRecord.occurred_at.desc())
    )
    return [
        PaymentRecordRead(
            id=record.id,
            order_id=order.id,
            order_no=order.order_no,
            provider=record.provider,
            event_type=record.event_type,
            amount_cents=record.amount_cents,
            occurred_at=record.occurred_at,
        )
        for record, order in result.all()
    ]


async def handle_payment_callback(
    db: AsyncSession,
    provider: PaymentProvider | str,
    payload: PaymentCallbackPayload,
) -> PaymentCallbackResult:
    parsed_provider = PaymentProvider(provider)
    order = await _find_order(db, payload.order_no)
    if order is None or order.provider != parsed_provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="支付订单不存在")
    occurred_at = payload.occurred_at or _now()
    if order.status == PaymentOrderStatus.PAID and payload.event_type == PaymentEventType.PAID:
        return PaymentCallbackResult(handled=True, order_id=order.id, status=order.status, message="订单已处理")
    if payload.event_type == PaymentEventType.PAID and payload.amount_cents != order.amount_cents:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="支付金额与订单不一致")

    before = _read_order(order).model_dump(mode="json")
    if payload.event_type == PaymentEventType.PAID:
        order.status = PaymentOrderStatus.PAID
        order.provider_order_id = payload.provider_order_id
        order.paid_at = occurred_at
    elif payload.event_type == PaymentEventType.FAILED:
        order.status = PaymentOrderStatus.FAILED
    elif payload.event_type == PaymentEventType.CANCELED:
        order.status = PaymentOrderStatus.CANCELED
    elif payload.event_type == PaymentEventType.REFUNDED:
        order.status = PaymentOrderStatus.REFUNDED

    record = PaymentRecord(
        order_id=order.id,
        provider=parsed_provider,
        event_type=payload.event_type,
        amount_cents=payload.amount_cents,
        raw_payload=payload.model_dump(mode="json"),
        occurred_at=occurred_at,
    )
    db.add(record)
    await db.commit()
    await db.refresh(order)

    if payload.event_type == PaymentEventType.PAID:
        plan = await membership_service.get_membership_plan(db, order.plan_id)
        period_start = payload.current_period_start or occurred_at
        await membership_service.apply_subscription_change(
            db,
            order.user_id,
            SubscriptionChangePayload(
                plan_id=order.plan_id,
                current_period_start=period_start,
                current_period_end=payload.current_period_end or _period_end(period_start, plan.billing_period.value),
                auto_renew=payload.auto_renew,
            ),
        )
    elif payload.event_type == PaymentEventType.REFUNDED:
        await membership_service.cancel_membership(db, order.user_id, reason=payload.message or "payment_refunded")

    await audit_service.write_audit_log(
        db,
        AuditLogCreateInternal(
            operator_type=AuditOperatorType.PAYMENT_PROVIDER,
            operator_id=None,
            action=f"payment_order.{payload.event_type.value}",
            target_type="payment_order",
            target_id=order.id,
            before_snapshot=AuditSnapshot(values=before),
            after_snapshot=AuditSnapshot(values=_read_order(order).model_dump(mode="json")),
            reason=payload.message,
        ),
    )
    return PaymentCallbackResult(handled=True, order_id=order.id, status=order.status, message=payload.message)


async def create_refund(db: AsyncSession, order_id: int, payload: RefundCreate) -> RefundRecordRead:
    order = await db.get(PaymentOrder, order_id)
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="支付订单不存在")
    if order.status != PaymentOrderStatus.PAID:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="订单状态不可退款")
    if payload.amount_cents > order.amount_cents:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="退款金额不能超过订单金额")
    refund = RefundRecord(
        order_id=order.id,
        refund_no=_refund_no(),
        amount_cents=payload.amount_cents,
        reason=payload.reason,
        status=RefundStatus.PENDING,
    )
    db.add(refund)
    await db.commit()
    await db.refresh(refund)
    return RefundRecordRead(
        id=refund.id,
        order_id=refund.order_id,
        refund_no=refund.refund_no,
        amount_cents=refund.amount_cents,
        reason=refund.reason,
        status=refund.status,
        provider_refund_id=refund.provider_refund_id,
        created_at=refund.created_at,
        updated_at=refund.updated_at,
    )
