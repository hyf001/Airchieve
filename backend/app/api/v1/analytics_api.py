from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.account_api import current_admin_user_id, optional_current_user_id
from app.db.session import get_db
from app.schema.analytics import AnalyticsEventCreate, AnalyticsEventRead, BookMetricsRead, CreationFunnelMetricsRead, OperationDashboardRead
from app.service import analytics

router = APIRouter()
admin_router = APIRouter()


@router.post("/events", response_model=AnalyticsEventRead)
async def track_client_event(
    payload: AnalyticsEventCreate,
    db: AsyncSession = Depends(get_db),
    user_id: int | None = Depends(optional_current_user_id),
) -> AnalyticsEventRead:
    return await analytics.track_client_event(db, user_id=user_id, payload=payload)


@admin_router.get("/dashboard", response_model=OperationDashboardRead)
async def get_operation_dashboard(
    range_start: date | None = None,
    range_end: date | None = None,
    db: AsyncSession = Depends(get_db),
    _: int = Depends(current_admin_user_id),
) -> OperationDashboardRead:
    return await analytics.get_operation_dashboard(db, range_start=range_start, range_end=range_end)


@admin_router.get("/books/{book_id}", response_model=BookMetricsRead)
async def get_book_metrics(
    book_id: int,
    db: AsyncSession = Depends(get_db),
    _: int = Depends(current_admin_user_id),
) -> BookMetricsRead:
    return await analytics.get_book_metrics(db, book_id)


@admin_router.get("/creation-funnel", response_model=CreationFunnelMetricsRead)
async def get_creation_funnel(
    db: AsyncSession = Depends(get_db),
    _: int = Depends(current_admin_user_id),
) -> CreationFunnelMetricsRead:
    return await analytics.get_creation_funnel_metrics(db)
