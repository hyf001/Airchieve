from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.model.asset import (
    Asset,
    AssetAccessLevel,
    AssetKind,
    AssetModerationStatus,
    AssetSourceType,
    AssetStatus,
    LibraryItemStatus,
    Voice,
    VoiceProcessingStatus,
)
from app.model.privacy import UploadConsentTargetType
from app.schema.asset import AssetInternalDTO, VoiceCreateRequest, VoiceListRead, VoiceRead, VoiceSummary, VoiceUpdateRequest
from app.schema.entitlement import EntitlementResourceType
from app.service import entitlement as entitlement_service
from app.service.privacy import assert_upload_consent, set_visibility_policy


def _voice_summary(voice: Voice) -> VoiceSummary:
    return VoiceSummary.model_validate(voice)


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
