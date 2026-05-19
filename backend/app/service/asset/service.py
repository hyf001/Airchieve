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
    Voice,
    VoiceProcessingStatus,
)
from app.model.generation_task import GenerationTaskType
from app.model.privacy import UploadConsentTargetType
from app.schema.asset import (
    ArtStyleListRead,
    ArtStyleRead,
    AssetInternalDTO,
    AssetRead,
    CharacterCreateRequest,
    CharacterListRead,
    CharacterRead,
    CharacterSummary,
    CharacterUpdateRequest,
    CustomArtStyleCreate,
    VoiceCreateRequest,
    VoiceListRead,
    VoiceRead,
    VoiceSummary,
    VoiceUpdateRequest,
)
from app.schema.entitlement import EntitlementResourceType
from app.schema.generation_task import GenerationTaskCreate
from app.service import entitlement as entitlement_service
from app.service import generation_task
from app.service.privacy import assert_upload_consent, set_visibility_policy


def _character_summary(character: Character) -> CharacterSummary:
    return CharacterSummary.model_validate(character)


def _voice_summary(voice: Voice) -> VoiceSummary:
    return VoiceSummary.model_validate(voice)


async def get_asset(db: AsyncSession, asset_id: int, *, user_id: int | None = None) -> AssetRead:
    asset = await db.get(Asset, asset_id)
    if asset is None or asset.status == AssetStatus.DELETED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="素材文件不存在")
    if asset.owner_user_id is not None and asset.owner_user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问该素材文件")
    return AssetRead.model_validate(asset)


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


async def list_voices(
    db: AsyncSession,
    *,
    user_id: int | None = None,
    source_type: AssetSourceType | None = None,
    limit: int = 50,
    offset: int = 0,
) -> VoiceListRead:
    owner_condition = or_(Voice.owner_user_id.is_(None), Voice.owner_user_id == user_id) if user_id else Voice.owner_user_id.is_(None)
    conditions = [
        owner_condition,
        Voice.status == LibraryItemStatus.ACTIVE,
        Voice.moderation_status == AssetModerationStatus.APPROVED,
    ]
    if source_type:
        conditions.append(Voice.source_type == source_type)
    stmt = select(Voice).where(*conditions).order_by(Voice.is_default.desc(), Voice.created_at.desc())
    result = await db.execute(stmt.offset(offset).limit(limit))
    total = await db.scalar(select(func.count()).select_from(Voice).where(*conditions))
    return VoiceListRead(items=[_voice_summary(voice) for voice in result.scalars().all()], total=total or 0, limit=limit, offset=offset)


async def get_voice(db: AsyncSession, voice_id: int, *, user_id: int | None = None) -> VoiceRead:
    voice = await _get_voice_model(db, voice_id, user_id=user_id)
    return VoiceRead.model_validate(voice)


async def create_voice(db: AsyncSession, user_id: int, payload: VoiceCreateRequest) -> VoiceRead:
    await entitlement_service.assert_can_create(db, user_id, EntitlementResourceType.VOICE)
    sample = await db.get(Asset, payload.source_sample_asset_id)
    if sample is None or sample.owner_user_id != user_id or sample.asset_kind != AssetKind.AUDIO or sample.status != AssetStatus.READY:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="声音样本不可用")
    await assert_upload_consent(
        db,
        user_id=user_id,
        consent_id=payload.upload_consent_id,
        target_type=UploadConsentTargetType.VOICE_SAMPLE,
        target_id=payload.source_sample_asset_id,
    )
    voice = Voice(
        owner_user_id=user_id,
        name=payload.name,
        source_sample_asset_id=payload.source_sample_asset_id,
        sample_asset_id=None,
        sample_url=None,
        supported_languages=payload.supported_languages,
        duration_seconds=payload.duration_seconds,
        source_type=AssetSourceType.USER_UPLOAD,
        processing_status=VoiceProcessingStatus.PROCESSING,
    )
    db.add(voice)
    await db.flush()
    await set_visibility_policy(db, user_id=user_id, target_type="voice", target_id=voice.id)
    await db.commit()
    await db.refresh(voice)
    return VoiceRead.model_validate(voice)


async def update_voice(db: AsyncSession, user_id: int, voice_id: int, payload: VoiceUpdateRequest) -> VoiceRead:
    voice = await _get_owned_voice(db, user_id, voice_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(voice, field, value)
    await db.commit()
    await db.refresh(voice)
    return VoiceRead.model_validate(voice)


async def delete_voice(db: AsyncSession, user_id: int, voice_id: int) -> None:
    voice = await _get_owned_voice(db, user_id, voice_id)
    voice.status = LibraryItemStatus.DELETED
    voice.is_default = False
    await db.commit()


async def set_default_voice(db: AsyncSession, user_id: int, voice_id: int) -> VoiceRead:
    voice = await _get_owned_voice(db, user_id, voice_id)
    result = await db.execute(select(Voice).where(Voice.owner_user_id == user_id, Voice.is_default.is_(True)))
    for current in result.scalars().all():
        current.is_default = False
    voice.is_default = True
    await db.commit()
    await db.refresh(voice)
    return VoiceRead.model_validate(voice)


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


async def _get_voice_model(db: AsyncSession, voice_id: int, *, user_id: int | None) -> Voice:
    voice = await db.get(Voice, voice_id)
    if voice is None or voice.status != LibraryItemStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="声音不存在")
    if voice.moderation_status != AssetModerationStatus.APPROVED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="声音不存在")
    if voice.owner_user_id is not None and voice.owner_user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="声音不存在")
    return voice


async def _get_owned_voice(db: AsyncSession, user_id: int, voice_id: int) -> Voice:
    voice = await db.get(Voice, voice_id)
    if voice is None or voice.status != LibraryItemStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="声音不存在")
    if voice.owner_user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只能管理自己的声音")
    if voice.moderation_status != AssetModerationStatus.APPROVED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="声音不存在")
    return voice
