from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.model.asset import Asset, AssetAccessLevel, AssetKind, AssetSourceType, AssetStatus, BackgroundMusic, LibraryItemStatus
from app.model.book import Book, BookPublishStatus
from app.model.privacy import UploadConsentTargetType
from app.schema.asset import (
    AssetInternalDTO,
    BackgroundMusicBookReference,
    BackgroundMusicCreateRequest,
    BackgroundMusicListRead,
    BackgroundMusicRead,
    BackgroundMusicSummary,
    BackgroundMusicUpdateRequest,
    SystemBackgroundMusicCreate,
    SystemBackgroundMusicUpdate,
)
from app.service import storage as storage_service
from app.service.privacy import assert_upload_consent, set_visibility_policy


def _background_music_summary(music: BackgroundMusic) -> BackgroundMusicSummary:
    return BackgroundMusicSummary.model_validate(music)


async def _background_music_read(db: AsyncSession, music: BackgroundMusic) -> BackgroundMusicRead:
    result = await db.execute(
        select(Book)
        .where(Book.background_music_id == music.id, Book.publish_status != BookPublishStatus.DELETED)
        .order_by(Book.updated_at.desc())
        .limit(20)
    )
    referenced_books = [
        BackgroundMusicBookReference(
            id=book.id,
            title=book.title,
            cover_url=book.cover_url,
            publish_status=book.publish_status.value,
        )
        for book in result.scalars().all()
    ]
    return BackgroundMusicRead(**_background_music_summary(music).model_dump(), referenced_books=referenced_books)


async def _audio_url_from_owned_asset(
    db: AsyncSession,
    user_id: int,
    *,
    asset_id: int,
    upload_consent_id: int | None,
) -> str:
    asset = await db.get(Asset, asset_id)
    if (
        asset is None
        or asset.owner_user_id != user_id
        or asset.asset_kind != AssetKind.AUDIO
        or asset.status != AssetStatus.READY
    ):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="上传背景音乐音频不可用")
    await assert_upload_consent(
        db,
        user_id=user_id,
        consent_id=upload_consent_id,
        target_type=UploadConsentTargetType.UPLOAD_FILE,
        target_id=asset_id,
    )
    return storage_service.get_file_url(asset.storage_key)


async def list_background_music(
    db: AsyncSession,
    *,
    user_id: int | None = None,
    source_type: AssetSourceType | None = None,
    access_level: AssetAccessLevel | None = None,
    limit: int = 50,
    offset: int = 0,
) -> BackgroundMusicListRead:
    owner_condition = (
        or_(BackgroundMusic.owner_user_id.is_(None), BackgroundMusic.owner_user_id == user_id)
        if user_id
        else BackgroundMusic.owner_user_id.is_(None)
    )
    conditions = [owner_condition, BackgroundMusic.status == LibraryItemStatus.ACTIVE]
    if source_type:
        conditions.append(BackgroundMusic.source_type == source_type)
    if access_level:
        conditions.append(BackgroundMusic.access_level == access_level)
    stmt = select(BackgroundMusic).where(*conditions).order_by(
        BackgroundMusic.is_default.desc(),
        BackgroundMusic.sort_order.asc(),
        BackgroundMusic.created_at.desc(),
    )
    result = await db.execute(stmt.offset(offset).limit(limit))
    total = await db.scalar(select(func.count()).select_from(BackgroundMusic).where(*conditions))
    return BackgroundMusicListRead(
        items=[_background_music_summary(music) for music in result.scalars().all()],
        total=total or 0,
        limit=limit,
        offset=offset,
    )


async def get_background_music(db: AsyncSession, music_id: int, *, user_id: int | None = None) -> BackgroundMusicRead:
    music = await _get_background_music_model(db, music_id, user_id=user_id)
    return await _background_music_read(db, music)


async def create_background_music(db: AsyncSession, user_id: int, payload: BackgroundMusicCreateRequest) -> BackgroundMusicRead:
    audio_url = await _audio_url_from_owned_asset(
        db,
        user_id,
        asset_id=payload.audio_asset_id,
        upload_consent_id=payload.upload_consent_id,
    )
    music = BackgroundMusic(
        owner_user_id=user_id,
        name=payload.name,
        description=payload.description,
        audio_url=audio_url,
        duration_seconds=payload.duration_seconds,
        source_type=AssetSourceType.USER_UPLOAD,
    )
    db.add(music)
    await db.flush()
    await set_visibility_policy(db, user_id=user_id, target_type="background_music", target_id=music.id)
    await db.commit()
    await db.refresh(music)
    return await _background_music_read(db, music)


async def update_background_music(db: AsyncSession, user_id: int, music_id: int, payload: BackgroundMusicUpdateRequest) -> BackgroundMusicRead:
    music = await _get_owned_background_music(db, user_id, music_id)
    values = payload.model_dump(exclude_unset=True, exclude={"audio_asset_id", "upload_consent_id"})
    if payload.audio_asset_id is not None:
        values["audio_url"] = await _audio_url_from_owned_asset(
            db,
            user_id,
            asset_id=payload.audio_asset_id,
            upload_consent_id=payload.upload_consent_id,
        )
    for field, value in values.items():
        setattr(music, field, value)
    await db.commit()
    await db.refresh(music)
    return await _background_music_read(db, music)


async def delete_background_music(db: AsyncSession, user_id: int, music_id: int) -> None:
    music = await _get_owned_background_music(db, user_id, music_id)
    music.status = LibraryItemStatus.DELETED
    music.is_default = False
    await db.commit()


async def set_default_background_music(db: AsyncSession, user_id: int, music_id: int) -> BackgroundMusicRead:
    music = await _get_owned_background_music(db, user_id, music_id)
    result = await db.execute(
        select(BackgroundMusic).where(BackgroundMusic.owner_user_id == user_id, BackgroundMusic.is_default.is_(True))
    )
    for current in result.scalars().all():
        current.is_default = False
    music.is_default = True
    await db.commit()
    await db.refresh(music)
    return await _background_music_read(db, music)


async def list_admin_system_background_music(db: AsyncSession, *, limit: int = 100, offset: int = 0) -> BackgroundMusicListRead:
    conditions = [BackgroundMusic.owner_user_id.is_(None), BackgroundMusic.status != LibraryItemStatus.DELETED]
    stmt = select(BackgroundMusic).where(*conditions).order_by(BackgroundMusic.sort_order.asc(), BackgroundMusic.created_at.desc())
    result = await db.execute(stmt.offset(offset).limit(limit))
    total = await db.scalar(select(func.count()).select_from(BackgroundMusic).where(*conditions))
    return BackgroundMusicListRead(
        items=[_background_music_summary(music) for music in result.scalars().all()],
        total=total or 0,
        limit=limit,
        offset=offset,
    )


async def get_admin_system_background_music(db: AsyncSession, music_id: int) -> BackgroundMusicRead:
    music = await db.get(BackgroundMusic, music_id)
    if music is None or music.owner_user_id is not None or music.status == LibraryItemStatus.DELETED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="系统背景音乐不存在")
    return await _background_music_read(db, music)


async def create_system_background_music(db: AsyncSession, payload: SystemBackgroundMusicCreate) -> BackgroundMusicRead:
    music = BackgroundMusic(
        owner_user_id=None,
        name=payload.name,
        description=payload.description,
        audio_url=payload.audio_url,
        duration_seconds=payload.duration_seconds,
        access_level=payload.access_level,
        source_type=AssetSourceType.SYSTEM,
        sort_order=payload.sort_order,
        status=payload.status,
    )
    db.add(music)
    await db.commit()
    await db.refresh(music)
    return await _background_music_read(db, music)


async def update_system_background_music(
    db: AsyncSession,
    music_id: int,
    payload: SystemBackgroundMusicUpdate,
) -> BackgroundMusicRead:
    music = await db.get(BackgroundMusic, music_id)
    if music is None or music.owner_user_id is not None or music.status == LibraryItemStatus.DELETED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="系统背景音乐不存在")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(music, field, value)
    await db.commit()
    await db.refresh(music)
    return await _background_music_read(db, music)


async def delete_system_background_music(db: AsyncSession, music_id: int) -> None:
    music = await db.get(BackgroundMusic, music_id)
    if music is None or music.owner_user_id is not None or music.status == LibraryItemStatus.DELETED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="系统背景音乐不存在")
    referenced_count = await db.scalar(
        select(func.count()).select_from(Book).where(Book.background_music_id == music_id, Book.publish_status != BookPublishStatus.DELETED)
    )
    if referenced_count:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="该背景音乐已被绘本引用，不能删除")
    music.status = LibraryItemStatus.DELETED
    music.is_default = False
    await db.commit()


async def assert_background_music_usable(db: AsyncSession, user_id: int, music_id: int) -> AssetInternalDTO:
    music = await _get_background_music_model(db, music_id, user_id=user_id)
    return AssetInternalDTO(
        asset_type="background_music",
        asset_id=music.id,
        owner_user_id=music.owner_user_id,
        access_level=music.access_level,
        source_type=music.source_type,
        usable=music.status == LibraryItemStatus.ACTIVE,
    )


async def _get_background_music_model(db: AsyncSession, music_id: int, *, user_id: int | None) -> BackgroundMusic:
    music = await db.get(BackgroundMusic, music_id)
    if music is None or music.status != LibraryItemStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="背景音乐不存在")
    if music.owner_user_id is not None and music.owner_user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="背景音乐不存在")
    return music


async def _get_owned_background_music(db: AsyncSession, user_id: int, music_id: int) -> BackgroundMusic:
    music = await db.get(BackgroundMusic, music_id)
    if music is None or music.status != LibraryItemStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="背景音乐不存在")
    if music.owner_user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只能管理自己的背景音乐")
    return music
