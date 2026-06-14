from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.model.asset import (
    AssetAccessLevel,
    AssetKind,
    AssetSourceType,
    AssetVisibility,
    LibraryItemStatus,
    Voice,
)
from app.model.generation_task import GenerationTask, GenerationTaskType
from app.schema.asset import (
    AssetInternalDTO,
    AssetStorageDTO,
    SystemVoiceCreate,
    SystemVoiceSampleGenerateRequest,
    SystemVoiceUpdate,
    VoiceCreateRequest,
    VoiceListRead,
    VoiceRead,
    VoiceSummary,
    VoiceUpdateRequest,
)
from app.schema.entitlement import EntitlementResourceType
from app.schema.generation_task import GenerationTaskCreate, GenerationTaskRead
from app.schema.ai_provider import VoicePromptRef
from app.service import generation_task
from app.service import entitlement as entitlement_service
from app.service.ai_provider import service as ai_provider_service
from app.service.privacy import set_visibility_policy
from app.service import storage as storage_service


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
    voice = Voice(
        owner_user_id=user_id,
        name=payload.name,
        voice_style_code=payload.voice_style_code,
        voice_language=payload.voice_language,
        emotion_type=payload.emotion_type,
        sample_url=payload.sample_url,
        duration_seconds=payload.duration_seconds,
        source_type=AssetSourceType.USER_UPLOAD,
    )
    db.add(voice)
    await db.flush()
    await set_visibility_policy(db, user_id=user_id, target_type="voice", target_id=voice.id)
    await db.commit()
    await db.refresh(voice)
    return VoiceRead.model_validate(voice)


async def list_admin_system_voices(db: AsyncSession, *, limit: int = 100, offset: int = 0) -> VoiceListRead:
    conditions = [Voice.owner_user_id.is_(None), Voice.status != LibraryItemStatus.DELETED]
    stmt = select(Voice).where(*conditions).order_by(Voice.created_at.desc())
    result = await db.execute(stmt.offset(offset).limit(limit))
    total = await db.scalar(select(func.count()).select_from(Voice).where(*conditions))
    return VoiceListRead(items=[_voice_summary(voice) for voice in result.scalars().all()], total=total or 0, limit=limit, offset=offset)


async def get_admin_system_voice(db: AsyncSession, voice_id: int) -> VoiceRead:
    voice = await db.get(Voice, voice_id)
    if voice is None or voice.owner_user_id is not None or voice.status == LibraryItemStatus.DELETED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="系统声音不存在")
    return VoiceRead.model_validate(voice)


async def create_system_voice(db: AsyncSession, payload: SystemVoiceCreate) -> VoiceRead:
    voice = Voice(
        owner_user_id=None,
        name=payload.name,
        voice_style_code=payload.voice_style_code,
        voice_language=payload.voice_language,
        emotion_type=payload.emotion_type,
        sample_url=payload.sample_url,
        duration_seconds=payload.duration_seconds,
        access_level=payload.access_level,
        source_type=AssetSourceType.SYSTEM,
        status=payload.status,
    )
    db.add(voice)
    await db.commit()
    await db.refresh(voice)
    return VoiceRead.model_validate(voice)


async def create_system_voice_sample_task(db: AsyncSession, payload: SystemVoiceSampleGenerateRequest) -> GenerationTaskRead:
    if payload.voice_id is not None:
        voice = await db.get(Voice, payload.voice_id)
        if voice is None or voice.owner_user_id is not None or voice.status == LibraryItemStatus.DELETED:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="系统声音不存在")
        payload.voice_style_code = payload.voice_style_code or voice.voice_style_code or ""
        payload.voice_language = payload.voice_language or voice.voice_language
    task = await generation_task.create_task(
        db,
        GenerationTaskCreate(
            task_type=GenerationTaskType.AUDIO,
            owner_type="voice",
            owner_id=payload.voice_id or 0,
            user_id=None,
            input_payload=payload.model_dump(mode="json"),
        ),
    )
    await db.commit()
    return task


async def run_system_voice_sample_task(db: AsyncSession, task: GenerationTask) -> None:
    payload = SystemVoiceSampleGenerateRequest.model_validate(task.input_payload or {})
    if task.owner_id and payload.voice_id is None:
        payload.voice_id = task.owner_id
    if payload.voice_id is not None and (not payload.voice_style_code or not payload.voice_language):
        voice = await db.get(Voice, payload.voice_id)
        if voice is None or voice.owner_user_id is not None or voice.status == LibraryItemStatus.DELETED:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="系统声音不存在")
        payload.voice_style_code = payload.voice_style_code or voice.voice_style_code or ""
        payload.voice_language = payload.voice_language or voice.voice_language
    audio_result_url = await ai_provider_service.create_voice_sample_audio(
        db,
        text=payload.sample_text,
        voice_ref=VoicePromptRef(
            source="system",
            provider_voice_id=payload.voice_style_code,
            voice_language=payload.voice_language,
            emotion_type=payload.emotion_type,
        ),
    )
    audio = await _save_generated_audio_result(
        db,
        None,
        audio_url=audio_result_url,
    )
    if payload.voice_id is not None:
        voice = await db.get(Voice, payload.voice_id)
        if voice is None or voice.owner_user_id is not None or voice.status == LibraryItemStatus.DELETED:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="系统声音不存在")
        voice.sample_url = audio.url
    await generation_task.mark_task_succeeded(
        db,
        task.id,
        result_refs={
            "asset_id": audio.id,
            "audio_url": audio.url,
            "sample_url": audio.url,
            "voice_id": payload.voice_id,
        },
    )


def _audio_extension_from_data_url(data_url: str) -> str:
    if data_url.startswith("data:audio/mpeg;") or data_url.startswith("data:audio/mp3;"):
        return ".mp3"
    if data_url.startswith("data:audio/wav;") or data_url.startswith("data:audio/x-wav;"):
        return ".wav"
    if data_url.startswith("data:audio/L16;") or data_url.startswith("data:audio/pcm;"):
        return ".pcm"
    return ".wav"


async def _save_generated_audio_result(db: AsyncSession, user_id: int | None, *, audio_url: str) -> AssetStorageDTO:
    if audio_url.startswith("data:"):
        return await storage_service.save_generated_data_url(
            db,
            user_id,
            data_url=audio_url,
            asset_kind=AssetKind.AUDIO,
            filename_extension=_audio_extension_from_data_url(audio_url),
            visibility=AssetVisibility.SYSTEM,
            path_scope="voice/sample",
        )
    return await storage_service.save_generated_url(
        db,
        user_id,
        url=audio_url,
        asset_kind=AssetKind.AUDIO,
        visibility=AssetVisibility.SYSTEM,
        path_scope="voice/sample",
    )


async def update_system_voice(db: AsyncSession, voice_id: int, payload: SystemVoiceUpdate) -> VoiceRead:
    voice = await db.get(Voice, voice_id)
    if voice is None or voice.owner_user_id is not None or voice.status == LibraryItemStatus.DELETED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="系统声音不存在")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(voice, field, value)
    await db.commit()
    await db.refresh(voice)
    return VoiceRead.model_validate(voice)


async def delete_system_voice(db: AsyncSession, voice_id: int) -> None:
    voice = await db.get(Voice, voice_id)
    if voice is None or voice.owner_user_id is not None or voice.status == LibraryItemStatus.DELETED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="系统声音不存在")
    voice.status = LibraryItemStatus.DELETED
    voice.is_default = False
    await db.commit()


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
        return AssetInternalDTO(
            asset_type=asset_type,
            asset_id=voice.id,
            owner_user_id=voice.owner_user_id,
            access_level=voice.access_level,
            source_type=voice.source_type,
            usable=voice.status == LibraryItemStatus.ACTIVE,
        )
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="不支持的素材类型")


async def _get_voice_model(db: AsyncSession, voice_id: int, *, user_id: int | None) -> Voice:
    voice = await db.get(Voice, voice_id)
    if voice is None or voice.status != LibraryItemStatus.ACTIVE:
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
    return voice
