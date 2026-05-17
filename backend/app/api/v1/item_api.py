from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schema.item import ItemCreate, ItemRead
from app.service import item_service

router = APIRouter()


@router.post("", response_model=ItemRead, status_code=201)
async def create_item(
    payload: ItemCreate,
    db: AsyncSession = Depends(get_db),
) -> ItemRead:
    return await item_service.create_item(db, payload)


@router.get("", response_model=list[ItemRead])
async def list_items(db: AsyncSession = Depends(get_db)) -> list[ItemRead]:
    return await item_service.list_items(db)
