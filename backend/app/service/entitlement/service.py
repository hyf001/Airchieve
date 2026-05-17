from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.model.entitlement import EntitlementQuotaReservation, QuotaReservationStatus
from app.model.membership import MembershipUsageCounter, UserMembershipStatus
from app.schema.entitlement import (
    AccessDecision,
    EntitlementLimits,
    EntitlementQuotaKey,
    EntitlementResourceType,
    EntitlementUsages,
    QuotaReservationRead,
    QuotaUsageRead,
    UserEntitlementsRead,
    VipPermissions,
)
from app.schema.membership import EntitlementAccessLevel, EntitlementConfigDTO, PdfExportQuality
from app.service import membership as membership_service


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _period_key(value: datetime | None = None) -> str:
    current = value or _now()
    return f"{current.year:04d}-{current.month:02d}"


def _reset_at(value: datetime | None = None) -> datetime:
    current = value or _now()
    if current.month == 12:
        return current.replace(year=current.year + 1, month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    return current.replace(month=current.month + 1, day=1, hour=0, minute=0, second=0, microsecond=0)


def _quota_limit(config: EntitlementConfigDTO, quota_key: EntitlementQuotaKey) -> int:
    match quota_key:
        case EntitlementQuotaKey.BOOK_GENERATION_MONTHLY:
            return config.book_generation_monthly_limit
        case EntitlementQuotaKey.SHARE_MONTHLY:
            return config.share_monthly_limit
        case EntitlementQuotaKey.PDF_EXPORT_MONTHLY:
            return config.pdf_export_monthly_limit


def _resource_limit(config: EntitlementConfigDTO, resource_type: EntitlementResourceType) -> int:
    match resource_type:
        case EntitlementResourceType.CHILD_PROFILE:
            return config.child_profile_limit
        case EntitlementResourceType.STORY:
            return config.story_limit
        case EntitlementResourceType.CHARACTER:
            return config.character_limit
        case EntitlementResourceType.VOICE:
            return config.voice_limit
        case EntitlementResourceType.BOOK_GENERATION:
            return config.book_generation_monthly_limit
        case EntitlementResourceType.SHARE:
            return config.share_monthly_limit
        case EntitlementResourceType.PDF_EXPORT:
            return config.pdf_export_monthly_limit


async def _get_counter(
    db: AsyncSession,
    user_id: int,
    quota_key: EntitlementQuotaKey,
    period_key: str,
) -> MembershipUsageCounter:
    result = await db.execute(
        select(MembershipUsageCounter).where(
            MembershipUsageCounter.user_id == user_id,
            MembershipUsageCounter.quota_key == quota_key.value,
            MembershipUsageCounter.period_key == period_key,
        )
    )
    counter = result.scalar_one_or_none()
    if counter is not None:
        return counter
    counter = MembershipUsageCounter(
        user_id=user_id,
        quota_key=quota_key.value,
        period_key=period_key,
        used_amount=0,
        reserved_amount=0,
        reset_at=_reset_at(),
    )
    db.add(counter)
    return counter


def _reservation_read(reservation: EntitlementQuotaReservation) -> QuotaReservationRead:
    return QuotaReservationRead(
        id=reservation.id,
        quota_key=EntitlementQuotaKey(reservation.quota_key),
        amount=reservation.amount,
        status=reservation.status,
        expires_at=reservation.expires_at,
    )


async def get_user_entitlements(db: AsyncSession, user_id: int) -> UserEntitlementsRead:
    membership = await membership_service.get_user_membership(db, user_id)
    config = await membership_service.get_user_entitlement_config(db, user_id)
    period = _period_key()
    counters = {}
    for quota_key in EntitlementQuotaKey:
        counter = await _get_counter(db, user_id, quota_key, period)
        counters[quota_key] = counter
    return UserEntitlementsRead(
        plan_code=membership.plan.code,
        membership_status=membership.status,
        access_level=config.access_level,
        book_access_level=config.book_access_level,
        limits=EntitlementLimits(
            child_profile_limit=config.child_profile_limit,
            story_limit=config.story_limit,
            character_limit=config.character_limit,
            voice_limit=config.voice_limit,
            share_monthly_limit=config.share_monthly_limit,
            book_generation_monthly_limit=config.book_generation_monthly_limit,
            pdf_export_monthly_limit=config.pdf_export_monthly_limit,
            pdf_export_quality=config.pdf_export_quality,
        ),
        usages=EntitlementUsages(
            period_key=period,
            book_generation_monthly_used=counters[EntitlementQuotaKey.BOOK_GENERATION_MONTHLY].used_amount,
            book_generation_monthly_reserved=counters[EntitlementQuotaKey.BOOK_GENERATION_MONTHLY].reserved_amount,
            share_monthly_used=counters[EntitlementQuotaKey.SHARE_MONTHLY].used_amount,
            share_monthly_reserved=counters[EntitlementQuotaKey.SHARE_MONTHLY].reserved_amount,
            pdf_export_monthly_used=counters[EntitlementQuotaKey.PDF_EXPORT_MONTHLY].used_amount,
            pdf_export_monthly_reserved=counters[EntitlementQuotaKey.PDF_EXPORT_MONTHLY].reserved_amount,
        ),
        vip_permissions=VipPermissions(
            vip_asset_enabled=config.vip_asset_enabled,
            system_story_vip_enabled=config.access_level == EntitlementAccessLevel.MEMBER,
            system_template_vip_enabled=config.access_level == EntitlementAccessLevel.MEMBER,
            export_hd_enabled=config.pdf_export_quality == PdfExportQuality.HD,
        ),
    )


async def can_access_book(db: AsyncSession, user_id: int, book_id: str) -> AccessDecision:
    config = await membership_service.get_user_entitlement_config(db, user_id)
    allowed = config.book_access_level == EntitlementAccessLevel.MEMBER
    return AccessDecision(
        allowed=allowed,
        access_level=config.book_access_level,
        preview_pages=None if allowed else 3,
        reason_code=None if allowed else "membership_required",
        upgrade_required=not allowed,
    )


async def can_use_asset(db: AsyncSession, user_id: int, asset_ref: str) -> AccessDecision:
    config = await membership_service.get_user_entitlement_config(db, user_id)
    return AccessDecision(
        allowed=config.vip_asset_enabled,
        access_level=config.access_level,
        reason_code=None if config.vip_asset_enabled else "vip_asset_required",
        upgrade_required=not config.vip_asset_enabled,
    )


async def assert_can_create(db: AsyncSession, user_id: int, resource_type: EntitlementResourceType | str) -> None:
    parsed_type = EntitlementResourceType(resource_type)
    config = await membership_service.get_user_entitlement_config(db, user_id)
    if _resource_limit(config, parsed_type) <= 0:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="当前会员权益不支持该操作")


async def assert_can_use_vip_resource(
    db: AsyncSession,
    user_id: int,
    resource_type: EntitlementResourceType | str,
    resource_id: str,
) -> None:
    config = await membership_service.get_user_entitlement_config(db, user_id)
    if config.access_level != EntitlementAccessLevel.MEMBER and not config.vip_asset_enabled:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="该资源需要会员权益")


async def reserve_quota(
    db: AsyncSession,
    user_id: int,
    quota_key: EntitlementQuotaKey | str,
    amount: int = 1,
    idempotency_key: str | None = None,
) -> QuotaReservationRead:
    if amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="额度数量必须大于 0")
    parsed_key = EntitlementQuotaKey(quota_key)
    if idempotency_key:
        existing = await db.execute(
            select(EntitlementQuotaReservation).where(
                EntitlementQuotaReservation.user_id == user_id,
                EntitlementQuotaReservation.quota_key == parsed_key.value,
                EntitlementQuotaReservation.idempotency_key == idempotency_key,
            )
        )
        reservation = existing.scalar_one_or_none()
        if reservation is not None:
            return _reservation_read(reservation)
    config = await membership_service.get_user_entitlement_config(db, user_id)
    limit = _quota_limit(config, parsed_key)
    period = _period_key()
    counter = await _get_counter(db, user_id, parsed_key, period)
    if counter.used_amount + counter.reserved_amount + amount > limit:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="会员额度不足")
    reservation = EntitlementQuotaReservation(
        user_id=user_id,
        quota_key=parsed_key.value,
        amount=amount,
        period_key=period,
        idempotency_key=idempotency_key,
        status=QuotaReservationStatus.RESERVED,
        expires_at=_now() + timedelta(minutes=30),
    )
    counter.reserved_amount += amount
    db.add(reservation)
    await db.commit()
    await db.refresh(reservation)
    return _reservation_read(reservation)


async def confirm_quota(db: AsyncSession, reservation_id: int) -> None:
    reservation = await db.get(EntitlementQuotaReservation, reservation_id)
    if reservation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="额度预占不存在")
    if reservation.status == QuotaReservationStatus.CONFIRMED:
        return
    if reservation.status != QuotaReservationStatus.RESERVED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="额度预占状态不可确认")
    counter = await _get_counter(db, reservation.user_id, EntitlementQuotaKey(reservation.quota_key), reservation.period_key)
    counter.reserved_amount = max(0, counter.reserved_amount - reservation.amount)
    counter.used_amount += reservation.amount
    reservation.status = QuotaReservationStatus.CONFIRMED
    await db.commit()


async def release_quota(db: AsyncSession, reservation_id: int, reason: str | None = None) -> None:
    reservation = await db.get(EntitlementQuotaReservation, reservation_id)
    if reservation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="额度预占不存在")
    if reservation.status == QuotaReservationStatus.RELEASED:
        return
    if reservation.status != QuotaReservationStatus.RESERVED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="额度预占状态不可释放")
    counter = await _get_counter(db, reservation.user_id, EntitlementQuotaKey(reservation.quota_key), reservation.period_key)
    counter.reserved_amount = max(0, counter.reserved_amount - reservation.amount)
    reservation.status = QuotaReservationStatus.RELEASED
    reservation.reason = reason
    await db.commit()


async def consume_quota(
    db: AsyncSession,
    user_id: int,
    quota_key: EntitlementQuotaKey | str,
    amount: int = 1,
    idempotency_key: str | None = None,
) -> QuotaUsageRead:
    reservation = await reserve_quota(db, user_id, quota_key, amount=amount, idempotency_key=idempotency_key)
    await confirm_quota(db, reservation.id)
    parsed_key = EntitlementQuotaKey(quota_key)
    period = _period_key()
    counter = await _get_counter(db, user_id, parsed_key, period)
    config = await membership_service.get_user_entitlement_config(db, user_id)
    limit = _quota_limit(config, parsed_key)
    remaining = max(0, limit - counter.used_amount - counter.reserved_amount)
    return QuotaUsageRead(
        quota_key=parsed_key,
        used_amount=counter.used_amount,
        limit_amount=limit,
        remaining_amount=remaining,
        period_key=period,
    )
