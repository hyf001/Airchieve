from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.account_api import current_admin_user_id
from app.db.session import get_db
from app.schema.admin import AdminContentOverviewRead, AdminDashboardRead
from app.schema.audit import AuditLogListRead, AuditLogRead
from app.schema.recommendation import (
    RecommendationItemRead,
    RecommendationItemStatusUpdate,
    RecommendationItemWrite,
    RecommendationSlotCreate,
    RecommendationSlotRead,
    RecommendationSlotUpdate,
)
from app.service import recommendation
from app.service import admin as admin_service, audit as audit_service

router = APIRouter()


@router.get("/dashboard", response_model=AdminDashboardRead)
async def get_admin_dashboard(
    db: AsyncSession = Depends(get_db),
    _: int = Depends(current_admin_user_id),
) -> AdminDashboardRead:
    return await admin_service.get_admin_dashboard(db)


@router.get("/content/overview", response_model=AdminContentOverviewRead)
async def get_content_overview(
    db: AsyncSession = Depends(get_db),
    _: int = Depends(current_admin_user_id),
) -> AdminContentOverviewRead:
    return await admin_service.get_content_overview(db)


@router.get("/audit/logs", response_model=AuditLogListRead)
async def list_audit_logs(
    action: str | None = None,
    target_type: str | None = None,
    operator_id: int | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: int = Depends(current_admin_user_id),
) -> AuditLogListRead:
    return await audit_service.list_audit_logs(
        db,
        action=action,
        target_type=target_type,
        operator_id=operator_id,
        limit=limit,
        offset=offset,
    )


@router.get("/audit/logs/{log_id}", response_model=AuditLogRead)
async def get_audit_log(
    log_id: int,
    db: AsyncSession = Depends(get_db),
    _: int = Depends(current_admin_user_id),
) -> AuditLogRead:
    return await audit_service.get_audit_log(db, log_id)


@router.post("/recommendation/slots", response_model=RecommendationSlotRead)
async def create_recommendation_slot(
    payload: RecommendationSlotCreate,
    db: AsyncSession = Depends(get_db),
    _: int = Depends(current_admin_user_id),
) -> RecommendationSlotRead:
    return await recommendation.create_recommendation_slot(db, payload)


@router.patch("/recommendation/slots/{slot_id}", response_model=RecommendationSlotRead)
async def update_recommendation_slot(
    slot_id: int,
    payload: RecommendationSlotUpdate,
    db: AsyncSession = Depends(get_db),
    _: int = Depends(current_admin_user_id),
) -> RecommendationSlotRead:
    return await recommendation.update_recommendation_slot(db, slot_id, payload)


@router.put("/recommendation/slots/{slot_id}/items", response_model=RecommendationSlotRead)
async def update_recommendation_items(
    slot_id: int,
    payload: list[RecommendationItemWrite],
    db: AsyncSession = Depends(get_db),
    _: int = Depends(current_admin_user_id),
) -> RecommendationSlotRead:
    return await recommendation.update_recommendation_items(db, slot_id, payload)


@router.patch("/recommendation/items/{item_id}/status", response_model=RecommendationItemRead)
async def set_recommendation_item_status(
    item_id: int,
    payload: RecommendationItemStatusUpdate,
    db: AsyncSession = Depends(get_db),
    _: int = Depends(current_admin_user_id),
) -> RecommendationItemRead:
    return await recommendation.set_recommendation_item_status(db, item_id, payload)
