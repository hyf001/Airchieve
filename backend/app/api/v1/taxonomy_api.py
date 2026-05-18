from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.account_api import current_admin_user_id
from app.db.session import get_db
from app.model.taxonomy import TaxonomyType
from app.schema.taxonomy import (
    TaxonomyItemCreate,
    TaxonomyItemRead,
    TaxonomyItemStatusUpdate,
    TaxonomyItemUpdate,
    TaxonomyReorderRequest,
)
from app.service import taxonomy

router = APIRouter()
admin_router = APIRouter()


@router.get("", response_model=list[TaxonomyItemRead])
async def list_taxonomy_items(
    type: TaxonomyType | None = None,
    include_disabled: bool = False,
    db: AsyncSession = Depends(get_db),
) -> list[TaxonomyItemRead]:
    return await taxonomy.list_taxonomy(db, taxonomy_type=type, include_disabled=include_disabled)


@router.get("/{item_id}", response_model=TaxonomyItemRead)
async def get_taxonomy_item(item_id: int, db: AsyncSession = Depends(get_db)) -> TaxonomyItemRead:
    return await taxonomy.get_taxonomy_item(db, item_id)


@admin_router.post("/items", response_model=TaxonomyItemRead, status_code=201)
async def create_taxonomy_item(
    payload: TaxonomyItemCreate,
    db: AsyncSession = Depends(get_db),
    _: int = Depends(current_admin_user_id),
) -> TaxonomyItemRead:
    result = await taxonomy.upsert_taxonomy_item(db, payload)
    await db.commit()
    return result


@admin_router.patch("/items/reorder", response_model=list[TaxonomyItemRead])
async def reorder_taxonomy_items(
    payload: TaxonomyReorderRequest,
    db: AsyncSession = Depends(get_db),
    _: int = Depends(current_admin_user_id),
) -> list[TaxonomyItemRead]:
    result = await taxonomy.reorder_taxonomy_items(db, payload.items)
    await db.commit()
    return result


@admin_router.patch("/items/{item_id}", response_model=TaxonomyItemRead)
async def update_taxonomy_item(
    item_id: int,
    payload: TaxonomyItemUpdate,
    db: AsyncSession = Depends(get_db),
    _: int = Depends(current_admin_user_id),
) -> TaxonomyItemRead:
    result = await taxonomy.update_taxonomy_item(db, item_id, payload)
    await db.commit()
    return result


@admin_router.patch("/items/{item_id}/status", response_model=TaxonomyItemRead)
async def set_taxonomy_item_status(
    item_id: int,
    payload: TaxonomyItemStatusUpdate,
    db: AsyncSession = Depends(get_db),
    _: int = Depends(current_admin_user_id),
) -> TaxonomyItemRead:
    result = await taxonomy.set_taxonomy_status(db, item_id, payload.status)
    await db.commit()
    return result
