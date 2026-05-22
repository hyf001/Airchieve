from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.model.asset import Asset, AssetStatus
from app.schema.asset import AssetRead


async def get_asset(db: AsyncSession, asset_id: int, *, user_id: int | None = None) -> AssetRead:
    asset = await db.get(Asset, asset_id)
    if asset is None or asset.status == AssetStatus.DELETED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="素材文件不存在")
    if asset.owner_user_id is not None and asset.owner_user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问该素材文件")
    return AssetRead.model_validate(asset)
