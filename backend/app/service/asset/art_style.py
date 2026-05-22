from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.model.asset import ArtStyle, ArtStyleStatus, Asset, AssetAccessLevel, AssetKind, AssetStatus, AssetVisibility
from app.schema.asset import ArtStyleListRead, ArtStyleRead, CustomArtStyleCreate, SystemArtStyleCreate, SystemArtStyleUpdate
from app.service import storage as storage_service


async def _fill_example_url_from_asset_id(db: AsyncSession, values: dict) -> None:
    asset_id = values.get("example_asset_id")
    if asset_id is None or values.get("example_url"):
        return
    asset = await db.get(Asset, asset_id)
    if asset is None or asset.status != AssetStatus.READY or asset.asset_kind != AssetKind.IMAGE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="画风示例图不可用")
    values["example_url"] = storage_service.get_file_url(asset.storage_key)


async def list_art_styles(
    db: AsyncSession,
    *,
    user_id: int | None = None,
    access_level: AssetAccessLevel | None = None,
    limit: int = 50,
    offset: int = 0,
) -> ArtStyleListRead:
    owner_condition = or_(ArtStyle.owner_user_id.is_(None), ArtStyle.owner_user_id == user_id) if user_id else ArtStyle.owner_user_id.is_(None)
    conditions = [owner_condition, ArtStyle.status == ArtStyleStatus.ACTIVE]
    if access_level:
        conditions.append(ArtStyle.access_level == access_level)
    stmt = select(ArtStyle).where(*conditions).order_by(ArtStyle.sort_order.asc(), ArtStyle.created_at.desc())
    result = await db.execute(stmt.offset(offset).limit(limit))
    total = await db.scalar(select(func.count()).select_from(ArtStyle).where(*conditions))
    return ArtStyleListRead(
        items=[ArtStyleRead.model_validate(style) for style in result.scalars().all()],
        total=total or 0,
        limit=limit,
        offset=offset,
    )


async def get_art_style(db: AsyncSession, style_id: int, *, user_id: int | None = None) -> ArtStyleRead:
    style = await db.get(ArtStyle, style_id)
    if style is None or style.status != ArtStyleStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="画风不存在")
    if style.owner_user_id is not None and style.owner_user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="画风不存在")
    return ArtStyleRead.model_validate(style)


async def list_admin_system_art_styles(db: AsyncSession, *, limit: int = 100, offset: int = 0) -> ArtStyleListRead:
    conditions = [ArtStyle.owner_user_id.is_(None), ArtStyle.status != ArtStyleStatus.DELETED]
    stmt = select(ArtStyle).where(*conditions).order_by(ArtStyle.sort_order.asc(), ArtStyle.created_at.desc())
    result = await db.execute(stmt.offset(offset).limit(limit))
    total = await db.scalar(select(func.count()).select_from(ArtStyle).where(*conditions))
    return ArtStyleListRead(
        items=[ArtStyleRead.model_validate(style) for style in result.scalars().all()],
        total=total or 0,
        limit=limit,
        offset=offset,
    )


async def get_admin_system_art_style(db: AsyncSession, style_id: int) -> ArtStyleRead:
    style = await db.get(ArtStyle, style_id)
    if style is None or style.owner_user_id is not None or style.status == ArtStyleStatus.DELETED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="系统画风不存在")
    return ArtStyleRead.model_validate(style)


async def create_system_art_style(db: AsyncSession, payload: SystemArtStyleCreate) -> ArtStyleRead:
    values = payload.model_dump(
        exclude={"example_image_base64", "example_image_mime_type", "example_image_filename"}
    )
    if payload.example_image_base64:
        if not payload.example_image_mime_type.startswith("image/"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="画风示例图必须是图片")
        asset = await storage_service.save_base64_asset(
            db,
            None,
            base64_data=payload.example_image_base64,
            mime_type=payload.example_image_mime_type,
            asset_kind=AssetKind.IMAGE,
            filename=payload.example_image_filename,
            visibility=AssetVisibility.SYSTEM,
        )
        values["example_asset_id"] = asset.id
        values["example_url"] = asset.url
    await _fill_example_url_from_asset_id(db, values)
    existing = await db.scalar(select(ArtStyle).where(ArtStyle.code == payload.code))
    if existing is not None and existing.status != ArtStyleStatus.DELETED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="画风编码已存在")
    if existing is not None:
        if existing.owner_user_id is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="画风编码已存在")
        for field, value in values.items():
            setattr(existing, field, value)
        await db.commit()
        await db.refresh(existing)
        return ArtStyleRead.model_validate(existing)
    style = ArtStyle(owner_user_id=None, **values)
    db.add(style)
    await db.commit()
    await db.refresh(style)
    return ArtStyleRead.model_validate(style)


async def update_system_art_style(db: AsyncSession, style_id: int, payload: SystemArtStyleUpdate) -> ArtStyleRead:
    style = await db.get(ArtStyle, style_id)
    if style is None or style.owner_user_id is not None or style.status == ArtStyleStatus.DELETED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="系统画风不存在")
    values = payload.model_dump(
        exclude_unset=True,
        exclude={"example_image_base64", "example_image_mime_type", "example_image_filename"},
    )
    if payload.example_image_base64:
        mime_type = payload.example_image_mime_type or "image/png"
        filename = payload.example_image_filename or "art-style-preview.png"
        if not mime_type.startswith("image/"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="画风示例图必须是图片")
        asset = await storage_service.save_base64_asset(
            db,
            None,
            base64_data=payload.example_image_base64,
            mime_type=mime_type,
            asset_kind=AssetKind.IMAGE,
            filename=filename,
            visibility=AssetVisibility.SYSTEM,
        )
        values["example_asset_id"] = asset.id
        values["example_url"] = asset.url
    await _fill_example_url_from_asset_id(db, values)
    next_code = values.get("code")
    if next_code and next_code != style.code:
        existing = await db.scalar(select(ArtStyle).where(ArtStyle.code == next_code, ArtStyle.id != style_id))
        if existing is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="画风编码已存在")
    for field, value in values.items():
        setattr(style, field, value)
    await db.commit()
    await db.refresh(style)
    return ArtStyleRead.model_validate(style)


async def delete_system_art_style(db: AsyncSession, style_id: int) -> None:
    style = await db.get(ArtStyle, style_id)
    if style is None or style.owner_user_id is not None or style.status == ArtStyleStatus.DELETED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="系统画风不存在")
    style.status = ArtStyleStatus.DELETED
    await db.commit()


async def create_custom_art_style(db: AsyncSession, user_id: int, payload: CustomArtStyleCreate) -> ArtStyleRead:
    style = ArtStyle(
        owner_user_id=user_id,
        name=payload.name,
        description=payload.description,
        prompt=payload.prompt or payload.description,
        access_level=AssetAccessLevel.FREE,
        status=ArtStyleStatus.ACTIVE,
    )
    db.add(style)
    await db.commit()
    await db.refresh(style)
    return ArtStyleRead.model_validate(style)
