"""
Page Service
页面业务逻辑
"""
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.page import Page
from app.models.enums import PageType
from app.schemas.page import PageCreate, TextUpdate, BaseImageUpdate


async def get_page_by_id(session: AsyncSession, page_id: int) -> Optional[Page]:
    """根据 ID 获取页面"""
    result = await session.execute(
        select(Page).where(Page.id == page_id)
    )
    return result.scalar_one_or_none()


async def get_page_detail(session: AsyncSession, page_id: int) -> Optional[dict]:
    """获取页面详情（含图层列表）"""
    from app.services.layer_service import get_layers_by_page_id

    page = await get_page_by_id(session, page_id)
    if page is None:
        return None

    layers = await get_layers_by_page_id(session, page_id)

    return {
        "id": page.id,
        "storybook_id": page.storybook_id,
        "page_index": page.page_index,
        "image_url": page.image_url,
        "text": page.text,
        "page_type": page.page_type.value if isinstance(page.page_type, PageType) else page.page_type,
        "storyboard": page.storyboard,
        "created_at": page.created_at,
        "updated_at": page.updated_at,
        "layers": layers,
    }


async def list_pages_by_storybook(session: AsyncSession, storybook_id: int) -> list[Page]:
    """获取绘本的所有页面（按 page_index 排序）"""
    result = await session.execute(
        select(Page)
        .where(Page.storybook_id == storybook_id)
        .order_by(Page.page_index)
    )
    return list(result.scalars().all())


async def create_page(session: AsyncSession, data: PageCreate) -> Page:
    """创建页面"""
    page = Page(
        storybook_id=data.storybook_id,
        page_index=data.page_index,
        image_url=data.image_url,
        text=data.text,
        page_type=PageType(data.page_type),
        storyboard=data.storyboard,
    )
    session.add(page)
    await session.flush()
    await session.refresh(page)
    return page


async def update_text(session: AsyncSession, page_id: int, data: TextUpdate) -> Optional[Page]:
    """更新页面文字"""
    page = await get_page_by_id(session, page_id)
    if page is None:
        return None

    if data.text is not None:
        page.text = data.text

    await session.flush()
    await session.refresh(page)
    return page


async def update_base_image(session: AsyncSession, page_id: int, data: BaseImageUpdate) -> Optional[Page]:
    """替换基图（只更新 image_url，不触碰图层）"""
    page = await get_page_by_id(session, page_id)
    if page is None:
        return None

    page.image_url = data.image_url
    await session.flush()
    await session.refresh(page)
    return page


async def delete_page(session: AsyncSession, page_id: int) -> bool:
    """删除页面"""
    page = await get_page_by_id(session, page_id)
    if page is None:
        return False

    await session.delete(page)
    await session.flush()
    return True
