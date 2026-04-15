"""
Layer Service
图层业务逻辑
"""
from typing import Optional

from pydantic import BaseModel, ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.layer import Layer
from app.models.enums import LayerType
from app.schemas.page import (
    LayerCreate,
    LayerUpdate,
    LayerReorder,
    TextLayerContent,
    DrawLayerContent,
    ImageLayerContent,
)

# layer_type -> content schema 映射
_CONTENT_SCHEMA_MAP = {
    LayerType.TEXT: TextLayerContent,
    LayerType.DRAW: DrawLayerContent,
    LayerType.IMAGE: ImageLayerContent,
}


def _to_dict(content) -> Optional[dict]:
    """将 content 统一转为 plain dict（Pydantic 模型 -> dict，dict 保持不变）。"""
    if content is None:
        return None
    if isinstance(content, BaseModel):
        return content.model_dump()
    return content


def _validate_content(layer_type: str, content) -> None:
    """按 layer_type 校验 content 结构，校验失败抛 ValueError。"""
    if content is None:
        return
    try:
        lt = LayerType(layer_type)
    except ValueError:
        return  # 未知类型不校验
    schema = _CONTENT_SCHEMA_MAP.get(lt)
    if schema is None:
        return  # 无对应 schema 的类型不校验
    try:
        schema.model_validate(content)
    except ValidationError as e:
        raise ValueError(
            f"图层 content 与 layer_type={layer_type!r} 不匹配: {e}"
        ) from e


async def get_layer_by_id(session: AsyncSession, layer_id: int) -> Optional[Layer]:
    """根据 ID 获取图层"""
    result = await session.execute(
        select(Layer).where(Layer.id == layer_id)
    )
    return result.scalar_one_or_none()


async def get_layers_by_page_id(session: AsyncSession, page_id: int) -> list[dict]:
    """获取页面的所有图层（按 layer_index 排序）"""
    result = await session.execute(
        select(Layer)
        .where(Layer.page_id == page_id)
        .order_by(Layer.layer_index)
    )
    layers = result.scalars().all()
    return [
        {
            "id": layer.id,
            "page_id": layer.page_id,
            "layer_type": layer.layer_type.value if isinstance(layer.layer_type, LayerType) else layer.layer_type,
            "layer_index": layer.layer_index,
            "visible": layer.visible,
            "locked": layer.locked,
            "content": layer.content,
            "created_at": layer.created_at,
            "updated_at": layer.updated_at,
        }
        for layer in layers
    ]


async def create_layer(session: AsyncSession, page_id: int, data: LayerCreate) -> Layer:
    """创建图层"""
    if data.content is not None:
        _validate_content(data.layer_type, data.content)
    layer = Layer(
        page_id=page_id,
        layer_type=LayerType(data.layer_type),
        layer_index=data.layer_index,
        visible=True,
        locked=False,
        content=_to_dict(data.content),
    )
    session.add(layer)
    await session.flush()
    await session.refresh(layer)
    return layer


async def update_layer(session: AsyncSession, layer_id: int, data: LayerUpdate) -> Optional[Layer]:
    """更新图层（只更新传入的字段）"""
    layer = await get_layer_by_id(session, layer_id)
    if layer is None:
        return None

    if data.layer_type is not None:
        layer.layer_type = LayerType(data.layer_type)
    if data.layer_index is not None:
        layer.layer_index = data.layer_index
    if data.visible is not None:
        layer.visible = data.visible
    if data.locked is not None:
        layer.locked = data.locked
    if data.content is not None:
        _validate_content(layer.layer_type if data.layer_type is None else data.layer_type, data.content)
        layer.content = _to_dict(data.content)

    await session.flush()
    await session.refresh(layer)
    return layer


async def delete_layer(session: AsyncSession, layer_id: int) -> bool:
    """删除图层"""
    layer = await get_layer_by_id(session, layer_id)
    if layer is None:
        return False

    await session.delete(layer)
    await session.flush()
    return True


async def reorder_layers(session: AsyncSession, page_id: int, data: LayerReorder) -> list[Layer]:
    """批量调整图层顺序"""
    # 获取该页面所有图层
    result = await session.execute(
        select(Layer)
        .where(Layer.page_id == page_id)
        .order_by(Layer.layer_index)
    )
    layers = list(result.scalars().all())

    # 构建 id -> layer 映射
    layer_map = {layer.id: layer for layer in layers}

    # 按 layer_ids 顺序重新分配 layer_index
    for new_index, layer_id in enumerate(data.layer_ids):
        if layer_id in layer_map:
            layer_map[layer_id].layer_index = new_index

    await session.flush()

    # 返回排序后的图层列表
    result = await session.execute(
        select(Layer)
        .where(Layer.page_id == page_id)
        .order_by(Layer.layer_index)
    )
    return list(result.scalars().all())
