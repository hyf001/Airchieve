from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.model.item import Item
from app.schema.item import ItemCreate


async def create_item(db: AsyncSession, payload: ItemCreate) -> Item:
    item = Item(name=payload.name, description=payload.description)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def list_items(db: AsyncSession) -> list[Item]:
    result = await db.execute(select(Item).order_by(Item.id.desc()))
    return list(result.scalars().all())
