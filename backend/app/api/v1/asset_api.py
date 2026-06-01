from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.account_api import current_user_id, optional_current_user_id
from app.db.session import get_db
from app.model.asset import AssetAccessLevel, AssetKind, AssetSourceType, AssetVisibility
from app.schema.asset import (
    ArtStyleListRead,
    ArtStyleRead,
    ArtStyleImageUploadRequest,
    AssetStorageDTO,
    BackgroundMusicCreateRequest,
    BackgroundMusicListRead,
    BackgroundMusicRead,
    BackgroundMusicUpdateRequest,
    CharacterCreateRequest,
    CharacterListRead,
    CharacterRead,
    CharacterUpdateRequest,
    CustomArtStyleCreate,
    CustomArtStyleUpdate,
    VoiceCreateRequest,
    VoiceListRead,
    VoiceRead,
    VoiceUpdateRequest,
)
from app.schema.storage import FileUrlRead, UploadCompleteRequest, UploadSessionCreate, UploadSessionRead
from app.service.asset import service as asset
from app.service.storage import service as storage

router = APIRouter()


@router.get("/characters", response_model=CharacterListRead)
async def list_characters(
    source_type: AssetSourceType | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user_id: int | None = Depends(optional_current_user_id),
) -> CharacterListRead:
    return await asset.list_characters(db, user_id=user_id, source_type=source_type, limit=limit, offset=offset)


@router.get("/characters/{character_id}", response_model=CharacterRead)
async def get_character(
    character_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int | None = Depends(optional_current_user_id),
) -> CharacterRead:
    return await asset.get_character(db, character_id, user_id=user_id)


@router.post("/characters", response_model=CharacterRead, status_code=status.HTTP_201_CREATED)
async def create_character(
    payload: CharacterCreateRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> CharacterRead:
    return await asset.create_character(db, user_id, payload)


@router.post("/characters/image", response_model=AssetStorageDTO, status_code=status.HTTP_201_CREATED)
async def upload_character_reference_image(
    payload: ArtStyleImageUploadRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> AssetStorageDTO:
    if not payload.mime_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请上传图片文件")
    image = await storage.save_base64_asset(
        db,
        user_id,
        base64_data=payload.base64_data or "",
        mime_type=payload.mime_type,
        asset_kind=AssetKind.IMAGE,
        filename=payload.filename,
        visibility=AssetVisibility.PRIVATE,
        path_scope="character/reference",
    )
    await db.commit()
    return image


@router.patch("/characters/{character_id}", response_model=CharacterRead)
async def update_character(
    character_id: int,
    payload: CharacterUpdateRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> CharacterRead:
    return await asset.update_character(db, user_id, character_id, payload)


@router.delete("/characters/{character_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_character(
    character_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> Response:
    await asset.delete_character(db, user_id, character_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/characters/{character_id}/default", response_model=CharacterRead)
async def set_default_character(
    character_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> CharacterRead:
    return await asset.set_default_character(db, user_id, character_id)


@router.get("/art-styles", response_model=ArtStyleListRead)
async def list_art_styles(
    access_level: AssetAccessLevel | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user_id: int | None = Depends(optional_current_user_id),
) -> ArtStyleListRead:
    return await asset.list_art_styles(db, user_id=user_id, access_level=access_level, limit=limit, offset=offset)


@router.get("/art-styles/{style_id}", response_model=ArtStyleRead)
async def get_art_style(
    style_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int | None = Depends(optional_current_user_id),
) -> ArtStyleRead:
    return await asset.get_art_style(db, style_id, user_id=user_id)


@router.post("/custom-art-styles", response_model=ArtStyleRead, status_code=status.HTTP_201_CREATED)
async def create_custom_art_style(
    payload: CustomArtStyleCreate,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> ArtStyleRead:
    return await asset.create_custom_art_style(db, user_id, payload)


@router.patch("/custom-art-styles/{style_id}", response_model=ArtStyleRead)
async def update_custom_art_style(
    style_id: int,
    payload: CustomArtStyleUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> ArtStyleRead:
    return await asset.update_custom_art_style(db, user_id, style_id, payload)


@router.delete("/custom-art-styles/{style_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_custom_art_style(
    style_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> Response:
    await asset.delete_custom_art_style(db, user_id, style_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/voices", response_model=VoiceListRead)
async def list_voices(
    source_type: AssetSourceType | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user_id: int | None = Depends(optional_current_user_id),
) -> VoiceListRead:
    return await asset.list_voices(db, user_id=user_id, source_type=source_type, limit=limit, offset=offset)


@router.get("/voices/{voice_id}", response_model=VoiceRead)
async def get_voice(
    voice_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int | None = Depends(optional_current_user_id),
) -> VoiceRead:
    return await asset.get_voice(db, voice_id, user_id=user_id)


@router.post("/voices", response_model=VoiceRead, status_code=status.HTTP_201_CREATED)
async def create_voice(
    payload: VoiceCreateRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> VoiceRead:
    return await asset.create_voice(db, user_id, payload)


@router.patch("/voices/{voice_id}", response_model=VoiceRead)
async def update_voice(
    voice_id: int,
    payload: VoiceUpdateRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> VoiceRead:
    return await asset.update_voice(db, user_id, voice_id, payload)


@router.delete("/voices/{voice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_voice(
    voice_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> Response:
    await asset.delete_voice(db, user_id, voice_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/voices/{voice_id}/default", response_model=VoiceRead)
async def set_default_voice(
    voice_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> VoiceRead:
    return await asset.set_default_voice(db, user_id, voice_id)


@router.get("/background-music", response_model=BackgroundMusicListRead)
async def list_background_music(
    source_type: AssetSourceType | None = None,
    access_level: AssetAccessLevel | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user_id: int | None = Depends(optional_current_user_id),
) -> BackgroundMusicListRead:
    return await asset.list_background_music(
        db,
        user_id=user_id,
        source_type=source_type,
        access_level=access_level,
        limit=limit,
        offset=offset,
    )


@router.get("/background-music/{music_id}", response_model=BackgroundMusicRead)
async def get_background_music(
    music_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int | None = Depends(optional_current_user_id),
) -> BackgroundMusicRead:
    return await asset.get_background_music(db, music_id, user_id=user_id)


@router.post("/background-music", response_model=BackgroundMusicRead, status_code=status.HTTP_201_CREATED)
async def create_background_music(
    payload: BackgroundMusicCreateRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> BackgroundMusicRead:
    return await asset.create_background_music(db, user_id, payload)


@router.patch("/background-music/{music_id}", response_model=BackgroundMusicRead)
async def update_background_music(
    music_id: int,
    payload: BackgroundMusicUpdateRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> BackgroundMusicRead:
    return await asset.update_background_music(db, user_id, music_id, payload)


@router.delete("/background-music/{music_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_background_music(
    music_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> Response:
    await asset.delete_background_music(db, user_id, music_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/background-music/{music_id}/default", response_model=BackgroundMusicRead)
async def set_default_background_music(
    music_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> BackgroundMusicRead:
    return await asset.set_default_background_music(db, user_id, music_id)


@router.post("/uploads", response_model=UploadSessionRead, status_code=status.HTTP_201_CREATED)
async def create_upload_session(
    payload: UploadSessionCreate,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> UploadSessionRead:
    if payload.purpose.value == "character":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="角色图片请使用后端图片上传接口")
    return await storage.create_upload_session(db, user_id, payload)


@router.post("/uploads/{upload_session_id}/complete", response_model=AssetStorageDTO)
async def complete_upload(
    upload_session_id: int,
    payload: UploadCompleteRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> AssetStorageDTO:
    return await storage.complete_upload(db, user_id, upload_session_id, payload)


@router.get("/files/by-asset/{asset_id}", response_model=FileUrlRead)
async def get_asset_file_url(
    asset_id: int,
    expires_in: int | None = Query(default=None, ge=60, le=86400),
    db: AsyncSession = Depends(get_db),
    user_id: int | None = Depends(optional_current_user_id),
) -> FileUrlRead:
    return FileUrlRead(url=await storage.get_asset_url(db, asset_id, user_id=user_id, expires_in=expires_in), expires_in=expires_in)
