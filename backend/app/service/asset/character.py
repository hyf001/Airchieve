from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.model.asset import (
    ArtStyle,
    ArtStyleStatus,
    Asset,
    AssetAccessLevel,
    AssetKind,
    AssetModerationStatus,
    AssetSourceType,
    AssetStatus,
    Character,
    LibraryItemStatus,
)
from app.model.generation_task import GenerationTaskType
from app.model.privacy import UploadConsentTargetType
from app.schema.asset import CharacterCreateRequest, CharacterListRead, CharacterRead, CharacterSummary, CharacterUpdateRequest, ArtStyleRead
from app.schema.entitlement import EntitlementResourceType
from app.schema.generation_task import GenerationTaskCreate
from app.service import entitlement as entitlement_service
from app.service import generation_task
from app.service.privacy import assert_upload_consent, set_visibility_policy


def _character_summary(character: Character) -> CharacterSummary:
    return CharacterSummary.model_validate(character)


async def list_characters(
    db: AsyncSession,
    *,
    user_id: int | None = None,
    source_type: AssetSourceType | None = None,
    limit: int = 50,
    offset: int = 0,
) -> CharacterListRead:
    owner_condition = or_(Character.owner_user_id.is_(None), Character.owner_user_id == user_id) if user_id else Character.owner_user_id.is_(None)
    conditions = [
        owner_condition,
        Character.status == LibraryItemStatus.ACTIVE,
        Character.moderation_status == AssetModerationStatus.APPROVED,
    ]
    if source_type:
        conditions.append(Character.source_type == source_type)
    stmt = select(Character).where(*conditions).order_by(Character.is_default.desc(), Character.created_at.desc())
    result = await db.execute(stmt.offset(offset).limit(limit))
    total = await db.scalar(select(func.count()).select_from(Character).where(*conditions))
    return CharacterListRead(
        items=[_character_summary(character) for character in result.scalars().all()],
        total=total or 0,
        limit=limit,
        offset=offset,
    )


async def get_character(db: AsyncSession, character_id: int, *, user_id: int | None = None) -> CharacterRead:
    character = await _get_character_model(db, character_id, user_id=user_id)
    art_style = await db.get(ArtStyle, character.art_style_id) if character.art_style_id else None
    return CharacterRead(
        **_character_summary(character).model_dump(),
        reference_asset_id=character.reference_asset_id,
        generation_prompt=character.generation_prompt,
        category_code=character.category_code,
        art_style=ArtStyleRead.model_validate(art_style) if art_style else None,
    )


async def create_character(db: AsyncSession, user_id: int, payload: CharacterCreateRequest) -> CharacterRead:
    await entitlement_service.assert_can_create(db, user_id, EntitlementResourceType.CHARACTER)
    if payload.reference_asset_id is not None:
        reference = await db.get(Asset, payload.reference_asset_id)
        if reference is None or reference.owner_user_id != user_id or reference.asset_kind != AssetKind.IMAGE or reference.status != AssetStatus.READY:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="参考图片不可用")
        await assert_upload_consent(
            db,
            user_id=user_id,
            consent_id=payload.upload_consent_id,
            target_type=UploadConsentTargetType.CHARACTER_REFERENCE_IMAGE,
            target_id=payload.reference_asset_id,
        )
    style = await db.get(ArtStyle, payload.art_style_id) if payload.art_style_id else None
    if payload.art_style_id is not None and (style is None or style.status != ArtStyleStatus.ACTIVE):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="画风不可用")
    if style is not None and style.owner_user_id is not None and style.owner_user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权使用该画风")
    if style is not None and style.access_level == AssetAccessLevel.VIP:
        await entitlement_service.assert_can_use_vip_resource(db, user_id, EntitlementResourceType.CHARACTER, str(style.id))

    character = Character(
        owner_user_id=user_id,
        name=payload.name,
        identity_tag=payload.identity_tag,
        description=payload.description,
        reference_asset_id=payload.reference_asset_id,
        art_style_id=payload.art_style_id,
        art_style_code=style.code if style else None,
        custom_art_style_prompt=payload.custom_art_style_prompt,
        generation_prompt=payload.generation_prompt,
        category_code=payload.category_code,
        age_range_codes=payload.age_range_codes,
        source_type=AssetSourceType.AI_GENERATED,
    )
    db.add(character)
    await db.flush()
    await generation_task.create_task(
        db,
        GenerationTaskCreate(
            task_type=GenerationTaskType.CHARACTER_IMAGE,
            owner_type="character",
            owner_id=character.id,
            user_id=user_id,
            input_payload={
                "reference_asset_id": payload.reference_asset_id,
                "art_style_id": payload.art_style_id,
                "custom_art_style_prompt": payload.custom_art_style_prompt,
                "generation_prompt": payload.generation_prompt,
            },
        ),
    )
    await set_visibility_policy(db, user_id=user_id, target_type="character", target_id=character.id)
    await db.commit()
    await db.refresh(character)
    return await get_character(db, character.id, user_id=user_id)


async def update_character(db: AsyncSession, user_id: int, character_id: int, payload: CharacterUpdateRequest) -> CharacterRead:
    character = await _get_owned_character(db, user_id, character_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(character, field, value)
    await db.commit()
    await db.refresh(character)
    return await get_character(db, character.id, user_id=user_id)


async def delete_character(db: AsyncSession, user_id: int, character_id: int) -> None:
    character = await _get_owned_character(db, user_id, character_id)
    character.status = LibraryItemStatus.DELETED
    character.is_default = False
    await db.commit()


async def set_default_character(db: AsyncSession, user_id: int, character_id: int) -> CharacterRead:
    character = await _get_owned_character(db, user_id, character_id)
    result = await db.execute(select(Character).where(Character.owner_user_id == user_id, Character.is_default.is_(True)))
    for current in result.scalars().all():
        current.is_default = False
    character.is_default = True
    await db.commit()
    await db.refresh(character)
    return await get_character(db, character.id, user_id=user_id)


async def _get_character_model(db: AsyncSession, character_id: int, *, user_id: int | None) -> Character:
    character = await db.get(Character, character_id)
    if character is None or character.status != LibraryItemStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="角色形象不存在")
    if character.moderation_status != AssetModerationStatus.APPROVED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="角色形象不存在")
    if character.owner_user_id is not None and character.owner_user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="角色形象不存在")
    return character


async def _get_owned_character(db: AsyncSession, user_id: int, character_id: int) -> Character:
    character = await db.get(Character, character_id)
    if character is None or character.status != LibraryItemStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="角色形象不存在")
    if character.owner_user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只能管理自己的角色形象")
    if character.moderation_status != AssetModerationStatus.APPROVED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="角色形象不存在")
    return character
