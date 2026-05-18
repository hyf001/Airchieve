from fastapi import APIRouter, Depends, Header, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.account_api import current_admin_user_id, current_user_id
from app.db.session import get_db
from app.model.audit import AuditOperatorType
from app.schema.audit import AuditLogCreateInternal, AuditSnapshot
from app.schema.entitlement import UserEntitlementsRead
from app.schema.membership import (
    MembershipPlanCreate,
    MembershipPlanRead,
    MembershipPlanStatusUpdate,
    MembershipPlanUpdate,
    UserMembershipRead,
)
from app.service import audit as audit_service, entitlement as entitlement_service, membership as membership_service

router = APIRouter()
admin_router = APIRouter()


def _audit_snapshot(value: MembershipPlanRead | None) -> AuditSnapshot | None:
    if value is None:
        return None
    return AuditSnapshot(values=value.model_dump(mode="json"))


async def _write_plan_audit(
    db: AsyncSession,
    *,
    operator_id: int,
    action: str,
    target_id: int,
    before: MembershipPlanRead | None,
    after: MembershipPlanRead | None,
    reason: str | None,
    request: Request,
    request_id: str | None,
) -> None:
    await audit_service.write_audit_log(
        db,
        AuditLogCreateInternal(
            operator_type=AuditOperatorType.ADMIN,
            operator_id=operator_id,
            action=action,
            target_type="membership_plan",
            target_id=target_id,
            before_snapshot=_audit_snapshot(before),
            after_snapshot=_audit_snapshot(after),
            reason=reason,
            request_id=request_id,
            user_agent=request.headers.get("user-agent"),
        ),
    )


@router.get("/plans", response_model=list[MembershipPlanRead])
async def list_plans(db: AsyncSession = Depends(get_db)) -> list[MembershipPlanRead]:
    return await membership_service.list_membership_plans(db)


@router.get("/me", response_model=UserMembershipRead)
async def get_my_membership(
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> UserMembershipRead:
    return await membership_service.get_user_membership(db, user_id)


@router.get("/entitlements", response_model=UserEntitlementsRead)
async def get_my_entitlements(
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> UserEntitlementsRead:
    return await entitlement_service.get_user_entitlements(db, user_id)


@admin_router.get("/plans", response_model=list[MembershipPlanRead])
async def admin_list_plans(
    db: AsyncSession = Depends(get_db),
    _: int = Depends(current_admin_user_id),
) -> list[MembershipPlanRead]:
    return await membership_service.list_membership_plans(db, include_inactive=True)


@admin_router.post("/plans", response_model=MembershipPlanRead, status_code=status.HTTP_201_CREATED)
async def admin_create_plan(
    payload: MembershipPlanCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    operator_id: int = Depends(current_admin_user_id),
    request_id: str | None = Header(default=None, alias="X-Request-ID"),
) -> MembershipPlanRead:
    plan = await membership_service.create_membership_plan(db, payload)
    await _write_plan_audit(
        db,
        operator_id=operator_id,
        action="membership_plan.create",
        target_id=plan.id,
        before=None,
        after=plan,
        reason=None,
        request=request,
        request_id=request_id,
    )
    return plan


@admin_router.patch("/plans/{plan_id}", response_model=MembershipPlanRead)
async def admin_update_plan(
    plan_id: int,
    payload: MembershipPlanUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    operator_id: int = Depends(current_admin_user_id),
    request_id: str | None = Header(default=None, alias="X-Request-ID"),
) -> MembershipPlanRead:
    before = await membership_service.get_membership_plan(db, plan_id)
    plan = await membership_service.update_membership_plan(db, plan_id, payload)
    await _write_plan_audit(
        db,
        operator_id=operator_id,
        action="membership_plan.update",
        target_id=plan.id,
        before=before,
        after=plan,
        reason=None,
        request=request,
        request_id=request_id,
    )
    return plan


@admin_router.patch("/plans/{plan_id}/status", response_model=MembershipPlanRead)
async def admin_update_plan_status(
    plan_id: int,
    payload: MembershipPlanStatusUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    operator_id: int = Depends(current_admin_user_id),
    request_id: str | None = Header(default=None, alias="X-Request-ID"),
) -> MembershipPlanRead:
    before = await membership_service.get_membership_plan(db, plan_id)
    plan = await membership_service.set_membership_plan_status(db, plan_id, payload.status)
    await _write_plan_audit(
        db,
        operator_id=operator_id,
        action="membership_plan.status.update",
        target_id=plan.id,
        before=before,
        after=plan,
        reason=payload.reason,
        request=request,
        request_id=request_id,
    )
    return plan
