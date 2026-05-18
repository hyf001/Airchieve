from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.model.taxonomy import TaxonomyItem, TaxonomyItemStatus, TaxonomyType
from app.schema.taxonomy import (
    TaxonomyItemCreate,
    TaxonomyItemRead,
    TaxonomyItemStatusUpdate,
    TaxonomyItemUpdate,
    TaxonomyReorderItem,
)


def _to_read(item: TaxonomyItem) -> TaxonomyItemRead:
    return TaxonomyItemRead(
        id=item.id,
        type=item.type,
        code=item.code,
        name=item.name,
        name_en=item.name_en,
        description=item.description,
        metadata=item.metadata_,
        sort_order=item.sort_order,
        status=item.status,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


async def list_taxonomy(
    db: AsyncSession,
    *,
    taxonomy_type: TaxonomyType | None = None,
    include_disabled: bool = False,
) -> list[TaxonomyItemRead]:
    conditions = []
    if taxonomy_type is not None:
        conditions.append(TaxonomyItem.type == taxonomy_type)
    if not include_disabled:
        conditions.append(TaxonomyItem.status == TaxonomyItemStatus.ACTIVE)

    stmt = select(TaxonomyItem).where(*conditions).order_by(TaxonomyItem.type, TaxonomyItem.sort_order, TaxonomyItem.id)
    result = await db.execute(stmt)
    return [_to_read(item) for item in result.scalars().all()]


async def get_taxonomy_item(db: AsyncSession, item_id: int) -> TaxonomyItemRead:
    item = await db.get(TaxonomyItem, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="分类项不存在")
    return _to_read(item)


async def validate_taxonomy_codes(db: AsyncSession, taxonomy_type: TaxonomyType, codes: list[str]) -> None:
    if not codes:
        return
    unique_codes = set(codes)
    stmt = select(TaxonomyItem).where(
        TaxonomyItem.code.in_(unique_codes),
        TaxonomyItem.type == taxonomy_type,
        TaxonomyItem.status == TaxonomyItemStatus.ACTIVE,
    )
    result = await db.execute(stmt)
    found = {item.code for item in result.scalars().all()}
    invalid = unique_codes - found
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"无效的分类 code: {sorted(invalid)}",
        )


async def upsert_taxonomy_item(db: AsyncSession, payload: TaxonomyItemCreate) -> TaxonomyItemRead:
    stmt = select(TaxonomyItem).where(TaxonomyItem.type == payload.type, TaxonomyItem.code == payload.code)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing is not None:
        existing.name = payload.name
        existing.name_en = payload.name_en
        existing.description = payload.description
        existing.metadata_ = payload.metadata
        existing.sort_order = payload.sort_order
        await db.flush()
        return _to_read(existing)

    item = TaxonomyItem(
        type=payload.type,
        code=payload.code,
        name=payload.name,
        name_en=payload.name_en,
        description=payload.description,
        metadata_=payload.metadata,
        sort_order=payload.sort_order,
        status=TaxonomyItemStatus.ACTIVE,
    )
    db.add(item)
    await db.flush()
    return _to_read(item)


async def update_taxonomy_item(db: AsyncSession, item_id: int, payload: TaxonomyItemUpdate) -> TaxonomyItemRead:
    item = await db.get(TaxonomyItem, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="分类项不存在")

    if payload.code is not None:
        item.code = payload.code
    if payload.name is not None:
        item.name = payload.name
    if payload.name_en is not None:
        item.name_en = payload.name_en
    if payload.description is not None:
        item.description = payload.description
    if payload.metadata is not None:
        item.metadata_ = payload.metadata
    if payload.sort_order is not None:
        item.sort_order = payload.sort_order
    await db.flush()
    return _to_read(item)


async def set_taxonomy_status(db: AsyncSession, item_id: int, new_status: TaxonomyItemStatus) -> TaxonomyItemRead:
    item = await db.get(TaxonomyItem, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="分类项不存在")
    item.status = new_status
    await db.flush()
    return _to_read(item)


async def reorder_taxonomy_items(db: AsyncSession, items: list[TaxonomyReorderItem]) -> list[TaxonomyItemRead]:
    id_map = {entry.id: entry.sort_order for entry in items}
    stmt = select(TaxonomyItem).where(TaxonomyItem.id.in_(id_map.keys()))
    result = await db.execute(stmt)
    entities = result.scalars().all()

    for entity in entities:
        entity.sort_order = id_map[entity.id]
    await db.flush()
    return [_to_read(entity) for entity in entities]
