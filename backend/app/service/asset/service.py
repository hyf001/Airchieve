from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.model.asset import (
    AssetAccessLevel,
    AssetModerationStatus,
    Character,
    LibraryItemStatus,
    VoiceProcessingStatus,
)
from app.schema.asset import AssetInternalDTO
from app.schema.entitlement import EntitlementResourceType
from app.service import entitlement as entitlement_service
from app.service import generation_task
from app.service.asset.art_style import (
    create_custom_art_style,
    create_system_art_style,
    delete_custom_art_style,
    delete_system_art_style,
    get_admin_system_art_style,
    get_art_style,
    list_admin_system_art_styles,
    list_art_styles,
    update_custom_art_style,
    update_system_art_style,
)
from app.service.asset.character import (
    create_character,
    delete_character,
    get_character,
    list_characters,
    set_default_character,
    update_character,
)
from app.service.asset.file_asset import get_asset
from app.service.asset.voice import (
    create_voice,
    delete_voice,
    get_voice,
    list_voices,
    set_default_voice,
    update_voice,
    _get_voice_model,
)


async def assert_asset_usable(db: AsyncSession, user_id: int, asset_type: str, asset_id: int) -> AssetInternalDTO:
    if asset_type == "character":
        character = await db.get(Character, asset_id)
        if character is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="角色形象不存在")
        if character.owner_user_id is not None and character.owner_user_id != user_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="角色形象不存在")
        if character.moderation_status != AssetModerationStatus.APPROVED:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="角色形象不存在")
        if character.owner_user_id is None and character.access_level == AssetAccessLevel.VIP:
            await entitlement_service.assert_can_use_vip_resource(db, user_id, EntitlementResourceType.CHARACTER, str(character.id))
        return AssetInternalDTO(
            asset_type=asset_type,
            asset_id=character.id,
            owner_user_id=character.owner_user_id,
            access_level=character.access_level,
            source_type=character.source_type,
            usable=character.status == LibraryItemStatus.ACTIVE,
        )
    if asset_type == "voice":
        voice = await _get_voice_model(db, asset_id, user_id=user_id)
        if voice.owner_user_id is None and voice.access_level == AssetAccessLevel.VIP:
            await entitlement_service.assert_can_use_vip_resource(db, user_id, EntitlementResourceType.VOICE, str(voice.id))
        if voice.processing_status != VoiceProcessingStatus.READY:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="声音尚未处理完成")
        return AssetInternalDTO(
            asset_type=asset_type,
            asset_id=voice.id,
            owner_user_id=voice.owner_user_id,
            access_level=voice.access_level,
            source_type=voice.source_type,
            usable=voice.status == LibraryItemStatus.ACTIVE and voice.processing_status == VoiceProcessingStatus.READY,
        )
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="不支持的素材类型")


__all__ = [
    "assert_asset_usable",
    "create_character",
    "create_custom_art_style",
    "create_system_art_style",
    "create_voice",
    "delete_character",
    "delete_custom_art_style",
    "delete_system_art_style",
    "delete_voice",
    "get_admin_system_art_style",
    "get_art_style",
    "get_asset",
    "get_character",
    "get_voice",
    "list_admin_system_art_styles",
    "list_art_styles",
    "list_characters",
    "list_voices",
    "set_default_character",
    "set_default_voice",
    "update_character",
    "update_custom_art_style",
    "update_system_art_style",
    "update_voice",
]
