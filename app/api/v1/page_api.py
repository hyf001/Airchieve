"""
Page & Layer API
页面与图层 CRUD 路由
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.page import (
    PageResponse,
    PageDetailResponse,
    TextUpdate,
    BaseImageUpdate,
    LayerResponse,
    LayerCreate,
    LayerUpdate,
    LayerReorder,
)
from app.services import page_service, layer_service

router = APIRouter(prefix="/pages", tags=["pages"])


# ---------------------------------------------------------------------------
# Page 端点
# ---------------------------------------------------------------------------

@router.get("/{page_id}", response_model=PageDetailResponse)
async def get_page(page_id: int, db: AsyncSession = Depends(get_db)):
    """获取单个页面详情（含图层列表）"""
    page = await page_service.get_page_detail(db, page_id)
    if page is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="页面不存在",
        )
    return page


@router.put("/{page_id}", response_model=PageResponse)
async def update_text(page_id: int, data: TextUpdate, db: AsyncSession = Depends(get_db)):
    """更新页面文字"""
    page = await page_service.update_text(db, page_id, data)
    if page is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="页面不存在",
        )
    return page


@router.post("/{page_id}/base-image", response_model=PageResponse)
async def update_base_image(page_id: int, data: BaseImageUpdate, db: AsyncSession = Depends(get_db)):
    """替换基图（AI 改图后调用，只更新 image_url，不触碰图层）"""
    page = await page_service.update_base_image(db, page_id, data)
    if page is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="页面不存在",
        )
    return page


@router.delete("/{page_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_page(page_id: int, db: AsyncSession = Depends(get_db)):
    """删除页面"""
    success = await page_service.delete_page(db, page_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="页面不存在",
        )


# ---------------------------------------------------------------------------
# Layer 端点
# ---------------------------------------------------------------------------

@router.get("/{page_id}/layers", response_model=list[LayerResponse])
async def list_layers(page_id: int, db: AsyncSession = Depends(get_db)):
    """获取页面的所有图层（按 layer_index 排序）"""
    # 先检查页面是否存在
    page = await page_service.get_page_by_id(db, page_id)
    if page is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="页面不存在",
        )
    return await layer_service.get_layers_by_page_id(db, page_id)


@router.post("/{page_id}/layers", response_model=LayerResponse, status_code=status.HTTP_201_CREATED)
async def create_layer(page_id: int, data: LayerCreate, db: AsyncSession = Depends(get_db)):
    """新增图层"""
    # 先检查页面是否存在
    page = await page_service.get_page_by_id(db, page_id)
    if page is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="页面不存在",
        )
    try:
        return await layer_service.create_layer(db, page_id, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.patch("/{page_id}/layers/{layer_id}", response_model=LayerResponse)
async def update_layer(page_id: int, layer_id: int, data: LayerUpdate, db: AsyncSession = Depends(get_db)):
    """更新图层（位置、内容、显隐等）"""
    try:
        layer = await layer_service.update_layer(db, layer_id, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    if layer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="图层不存在",
        )
    return layer


@router.delete("/{page_id}/layers/{layer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_layer(page_id: int, layer_id: int, db: AsyncSession = Depends(get_db)):
    """删除图层"""
    success = await layer_service.delete_layer(db, layer_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="图层不存在",
        )


@router.patch("/{page_id}/layers/reorder", response_model=list[LayerResponse])
async def reorder_layers(page_id: int, data: LayerReorder, db: AsyncSession = Depends(get_db)):
    """批量调整图层顺序"""
    # 先检查页面是否存在
    page = await page_service.get_page_by_id(db, page_id)
    if page is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="页面不存在",
        )
    layers = await layer_service.reorder_layers(db, page_id, data)
    return layers
