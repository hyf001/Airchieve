from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.model.membership import (
    BillingPeriod,
    MembershipPlan,
    MembershipPlanStatus,
    MembershipSource,
    UserMembership,
    UserMembershipStatus,
)
from app.schema.membership import (
    EntitlementAccessLevel,
    EntitlementConfigDTO,
    MembershipPlanCreate,
    MembershipPlanRead,
    MembershipPlanSummary,
    MembershipPlanUpdate,
    SubscriptionChangePayload,
    UserMembershipRead,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def default_free_entitlement_config() -> EntitlementConfigDTO:
    return EntitlementConfigDTO(
        access_level=EntitlementAccessLevel.FREE,
        book_access_level=EntitlementAccessLevel.FREE,
        child_profile_limit=1,
        story_limit=20,
        character_limit=3,
        voice_limit=1,
        share_monthly_limit=5,
        book_generation_monthly_limit=0,
        pdf_export_monthly_limit=0,
        vip_asset_enabled=False,
    )


def _config_to_json(config: EntitlementConfigDTO) -> dict[str, object]:
    return config.model_dump(mode="json")


def _config_from_json(value: dict[str, object]) -> EntitlementConfigDTO:
    return EntitlementConfigDTO.model_validate(value)


def _plan_summary(plan: MembershipPlan | None) -> MembershipPlanSummary:
    if plan is None:
        return MembershipPlanSummary(
            id=None,
            code="free",
            name="免费版",
            billing_period=BillingPeriod.NONE,
        )
    return MembershipPlanSummary(
        id=plan.id,
        code=plan.code,
        name=plan.name,
        billing_period=plan.billing_period,
    )


def _plan_read(plan: MembershipPlan) -> MembershipPlanRead:
    return MembershipPlanRead(
        id=plan.id,
        code=plan.code,
        name=plan.name,
        description=plan.description,
        price_cents=plan.price_cents,
        currency=plan.currency,
        billing_period=plan.billing_period,
        entitlement_config=_config_from_json(plan.entitlement_config),
        sort_order=plan.sort_order,
        status=plan.status,
        created_at=plan.created_at,
        updated_at=plan.updated_at,
    )


def _membership_read(membership: UserMembership | None, user_id: int, plan: MembershipPlan | None) -> UserMembershipRead:
    if membership is None:
        return UserMembershipRead(
            user_id=user_id,
            plan=_plan_summary(plan),
            status=UserMembershipStatus.FREE,
            started_at=None,
            current_period_start=None,
            current_period_end=None,
            auto_renew=False,
            source=MembershipSource.SYSTEM,
        )
    return UserMembershipRead(
        user_id=membership.user_id,
        plan=_plan_summary(plan),
        status=membership.status,
        started_at=membership.started_at,
        current_period_start=membership.current_period_start,
        current_period_end=membership.current_period_end,
        auto_renew=membership.auto_renew,
        source=membership.source,
    )


async def _get_free_plan(db: AsyncSession) -> MembershipPlan | None:
    result = await db.execute(select(MembershipPlan).where(MembershipPlan.code == "free"))
    return result.scalar_one_or_none()


async def list_membership_plans(
    db: AsyncSession,
    *,
    include_inactive: bool = False,
) -> list[MembershipPlanRead]:
    stmt = select(MembershipPlan).order_by(MembershipPlan.sort_order.asc(), MembershipPlan.price_cents.asc())
    if not include_inactive:
        stmt = stmt.where(MembershipPlan.status == MembershipPlanStatus.ACTIVE)
    result = await db.execute(stmt)
    return [_plan_read(plan) for plan in result.scalars().all()]


async def get_membership_plan(db: AsyncSession, plan_id: int) -> MembershipPlanRead:
    plan = await db.get(MembershipPlan, plan_id)
    if plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="会员计划不存在")
    return _plan_read(plan)


async def get_user_membership(db: AsyncSession, user_id: int) -> UserMembershipRead:
    result = await db.execute(
        select(UserMembership, MembershipPlan)
        .join(MembershipPlan, UserMembership.plan_id == MembershipPlan.id)
        .where(UserMembership.user_id == user_id)
        .order_by(UserMembership.created_at.desc())
        .limit(1)
    )
    row = result.one_or_none()
    if row is None:
        return _membership_read(None, user_id, await _get_free_plan(db))
    membership, plan = row
    if membership.status in {UserMembershipStatus.CANCELED, UserMembershipStatus.EXPIRED}:
        free_plan = await _get_free_plan(db)
        return _membership_read(None, user_id, free_plan)
    return _membership_read(membership, user_id, plan)


async def get_user_entitlement_config(db: AsyncSession, user_id: int) -> EntitlementConfigDTO:
    result = await db.execute(
        select(UserMembership, MembershipPlan)
        .join(MembershipPlan, UserMembership.plan_id == MembershipPlan.id)
        .where(UserMembership.user_id == user_id)
        .order_by(UserMembership.created_at.desc())
        .limit(1)
    )
    row = result.one_or_none()
    if row is None:
        free_plan = await _get_free_plan(db)
        return _config_from_json(free_plan.entitlement_config) if free_plan else default_free_entitlement_config()
    membership, plan = row
    if membership.status != UserMembershipStatus.ACTIVE:
        free_plan = await _get_free_plan(db)
        return _config_from_json(free_plan.entitlement_config) if free_plan else default_free_entitlement_config()
    return _config_from_json(plan.entitlement_config)


async def create_membership_plan(db: AsyncSession, payload: MembershipPlanCreate) -> MembershipPlanRead:
    existing = await db.execute(select(MembershipPlan).where(MembershipPlan.code == payload.code))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="会员计划编码已存在")
    plan = MembershipPlan(
        code=payload.code,
        name=payload.name,
        description=payload.description,
        price_cents=payload.price_cents,
        currency=payload.currency,
        billing_period=payload.billing_period,
        entitlement_config=_config_to_json(payload.entitlement_config),
        sort_order=payload.sort_order,
        status=payload.status,
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return _plan_read(plan)


async def update_membership_plan(db: AsyncSession, plan_id: int, payload: MembershipPlanUpdate) -> MembershipPlanRead:
    plan = await db.get(MembershipPlan, plan_id)
    if plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="会员计划不存在")
    data = payload.model_dump(exclude_unset=True)
    for field in ("name", "description", "price_cents", "currency", "billing_period", "sort_order", "status"):
        if field in data:
            setattr(plan, field, data[field])
    if payload.entitlement_config is not None:
        plan.entitlement_config = _config_to_json(payload.entitlement_config)
    await db.commit()
    await db.refresh(plan)
    return _plan_read(plan)


async def set_membership_plan_status(
    db: AsyncSession,
    plan_id: int,
    plan_status: MembershipPlanStatus,
) -> MembershipPlanRead:
    return await update_membership_plan(db, plan_id, MembershipPlanUpdate(status=plan_status))


async def apply_subscription_change(
    db: AsyncSession,
    user_id: int,
    payload: SubscriptionChangePayload,
) -> UserMembershipRead:
    plan = await db.get(MembershipPlan, payload.plan_id)
    if plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="会员计划不存在")
    result = await db.execute(select(UserMembership).where(UserMembership.user_id == user_id).limit(1))
    membership = result.scalar_one_or_none()
    if membership is None:
        membership = UserMembership(
            user_id=user_id,
            plan_id=plan.id,
            status=payload.status,
            started_at=payload.started_at or _now(),
            current_period_start=payload.current_period_start,
            current_period_end=payload.current_period_end,
            auto_renew=payload.auto_renew,
            source=payload.source,
        )
        db.add(membership)
    else:
        membership.plan_id = plan.id
        membership.status = payload.status
        membership.started_at = payload.started_at or membership.started_at or _now()
        membership.current_period_start = payload.current_period_start
        membership.current_period_end = payload.current_period_end
        membership.auto_renew = payload.auto_renew
        membership.source = payload.source
    await db.commit()
    await db.refresh(membership)
    return _membership_read(membership, user_id, plan)


async def cancel_membership(db: AsyncSession, user_id: int, reason: str | None = None) -> UserMembershipRead:
    result = await db.execute(select(UserMembership).where(UserMembership.user_id == user_id).limit(1))
    membership = result.scalar_one_or_none()
    if membership is None:
        return _membership_read(None, user_id, await _get_free_plan(db))
    membership.status = UserMembershipStatus.CANCELED
    membership.auto_renew = False
    membership.source = MembershipSource.ADMIN if reason else membership.source
    plan = await db.get(MembershipPlan, membership.plan_id)
    await db.commit()
    await db.refresh(membership)
    return _membership_read(membership, user_id, plan)
