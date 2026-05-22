from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.account_api import current_admin_user_id
from app.db.session import get_db
from app.model.asset import AssetKind, AssetVisibility
from app.model.audit import AuditOperatorType
from app.schema.admin import AdminContentOverviewRead, AdminDashboardRead
from app.schema.asset import (
    ArtStyleImageUploadRequest,
    ArtStyleListRead,
    ArtStyleRead,
    AssetStorageDTO,
    SystemArtStyleCreate,
    SystemArtStyleUpdate,
)
from app.schema.audit import AuditLogCreateInternal, AuditSnapshot
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
from app.service import asset as asset_service
from app.service import admin as admin_service, audit as audit_service
from app.service import storage as storage_service

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


@router.get("/art-styles", response_model=ArtStyleListRead)
async def list_admin_art_styles(
    limit: int = Query(default=100, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: int = Depends(current_admin_user_id),
) -> ArtStyleListRead:
    return await asset_service.list_admin_system_art_styles(db, limit=limit, offset=offset)


@router.post("/art-styles/image", response_model=AssetStorageDTO, status_code=status.HTTP_201_CREATED)
async def upload_admin_art_style_image(
    payload: ArtStyleImageUploadRequest,
    db: AsyncSession = Depends(get_db),
    operator_id: int = Depends(current_admin_user_id),
) -> AssetStorageDTO:
    if not payload.mime_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请上传图片文件")
    image = await storage_service.save_base64_asset(
        db,
        operator_id,
        base64_data=payload.base64_data or "",
        mime_type=payload.mime_type,
        asset_kind=AssetKind.IMAGE,
        filename=payload.filename,
        visibility=AssetVisibility.SYSTEM,
    )
    await audit_service.write_audit_log(
        db,
        AuditLogCreateInternal(
            operator_type=AuditOperatorType.ADMIN,
            operator_id=operator_id,
            action="admin.art_style.image_upload",
            target_type="asset",
            target_id=image.id,
            after_snapshot=AuditSnapshot(values=image.model_dump(mode="json")),
        ),
        commit=False,
    )
    await db.commit()
    return image


@router.post("/art-styles", response_model=ArtStyleRead, status_code=status.HTTP_201_CREATED)
async def create_admin_art_style(
    payload: SystemArtStyleCreate,
    db: AsyncSession = Depends(get_db),
    operator_id: int = Depends(current_admin_user_id),
) -> ArtStyleRead:
    style = await asset_service.create_system_art_style(db, payload)
    await audit_service.write_audit_log(
        db,
        AuditLogCreateInternal(
            operator_type=AuditOperatorType.ADMIN,
            operator_id=operator_id,
            action="admin.art_style.create",
            target_type="art_style",
            target_id=style.id,
            after_snapshot=AuditSnapshot(values=style.model_dump(mode="json")),
        ),
    )
    return style


@router.patch("/art-styles/{style_id}", response_model=ArtStyleRead)
async def update_admin_art_style(
    style_id: int,
    payload: SystemArtStyleUpdate,
    db: AsyncSession = Depends(get_db),
    operator_id: int = Depends(current_admin_user_id),
) -> ArtStyleRead:
    before = await asset_service.get_admin_system_art_style(db, style_id)
    style = await asset_service.update_system_art_style(db, style_id, payload)
    await audit_service.write_audit_log(
        db,
        AuditLogCreateInternal(
            operator_type=AuditOperatorType.ADMIN,
            operator_id=operator_id,
            action="admin.art_style.update",
            target_type="art_style",
            target_id=style.id,
            before_snapshot=AuditSnapshot(values=before.model_dump(mode="json")),
            after_snapshot=AuditSnapshot(values=style.model_dump(mode="json")),
        ),
    )
    return style


@router.delete("/art-styles/{style_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_admin_art_style(
    style_id: int,
    db: AsyncSession = Depends(get_db),
    operator_id: int = Depends(current_admin_user_id),
) -> Response:
    before = await asset_service.get_admin_system_art_style(db, style_id)
    await asset_service.delete_system_art_style(db, style_id)
    await audit_service.write_audit_log(
        db,
        AuditLogCreateInternal(
            operator_type=AuditOperatorType.ADMIN,
            operator_id=operator_id,
            action="admin.art_style.delete",
            target_type="art_style",
            target_id=style_id,
            before_snapshot=AuditSnapshot(values=before.model_dump(mode="json")),
        ),
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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
