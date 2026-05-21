from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.account_api import current_admin_user_id, optional_current_user_id
from app.db.session import get_db
from app.model.moderation import ModerationStatus
from app.schema.moderation import (
    ModerationHandleRequest,
    ModerationRecordListRead,
    ModerationRecordRead,
    ModerationReportRead,
    ReportCreate,
)
from app.service import moderation

router = APIRouter()
admin_router = APIRouter()


@router.post("/reports", response_model=ModerationReportRead, status_code=status.HTTP_201_CREATED)
async def create_report(
    payload: ReportCreate,
    db: AsyncSession = Depends(get_db),
    user_id: int | None = Depends(optional_current_user_id),
) -> ModerationReportRead:
    return await moderation.create_report(db, user_id=user_id, payload=payload)


@admin_router.get("/records", response_model=ModerationRecordListRead)
async def list_moderation_records(
    status_filter: ModerationStatus | None = Query(default=None, alias="status"),
    target_type: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: int = Depends(current_admin_user_id),
) -> ModerationRecordListRead:
    return await moderation.list_moderation_records(
        db,
        status_filter=status_filter,
        target_type=target_type,
        limit=limit,
        offset=offset,
    )


@admin_router.get("/records/{record_id}", response_model=ModerationRecordRead)
async def get_moderation_record(
    record_id: int,
    db: AsyncSession = Depends(get_db),
    _: int = Depends(current_admin_user_id),
) -> ModerationRecordRead:
    return await moderation.get_moderation_record(db, record_id)


@admin_router.post("/records/{record_id}/handle", response_model=ModerationRecordRead)
async def handle_moderation_record(
    record_id: int,
    payload: ModerationHandleRequest,
    db: AsyncSession = Depends(get_db),
    operator_id: int = Depends(current_admin_user_id),
) -> ModerationRecordRead:
    return await moderation.handle_moderation_record(db, operator_id=operator_id, record_id=record_id, payload=payload)


@admin_router.post("/records/{record_id}/approve", status_code=status.HTTP_204_NO_CONTENT)
async def approve_moderation_record(
    record_id: int,
    db: AsyncSession = Depends(get_db),
    operator_id: int = Depends(current_admin_user_id),
) -> Response:
    await moderation.handle_moderation_record(
        db,
        operator_id=operator_id,
        record_id=record_id,
        payload=ModerationHandleRequest(status=ModerationStatus.APPROVED, reason="审核通过"),
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
