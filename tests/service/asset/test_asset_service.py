"""Tests for asset service: character CRUD, voice CRUD, set_default, moderation, VIP, assert_asset_usable."""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.model.asset import (
    ArtStyle,
    ArtStyleStatus,
    Asset,
    AssetAccessLevel,
    AssetKind,
    AssetSourceType,
    AssetStatus,
    AssetVisibility,
    Character,
    LibraryItemStatus,
    Voice,
)
from app.model.generation_task import GenerationTask, GenerationTaskStatus, GenerationTaskType
from app.model.privacy import UploadConsentTargetType
from app.model.taxonomy import TaxonomyItem, TaxonomyItemStatus, TaxonomyType
from app.schema.asset import CharacterCreateRequest, CharacterUpdateRequest, SystemVoiceCreate, SystemVoiceSampleGenerateRequest, SystemVoiceUpdate, VoiceCreateRequest, VoiceUpdateRequest
from app.schema.privacy import UploadConsentCreate
from app.service import asset as asset_service
from app.service import privacy as privacy_service


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _make_user_asset(db: AsyncSession, user_id: int, kind: AssetKind = AssetKind.IMAGE) -> Asset:
    a = Asset(
        owner_user_id=user_id,
        asset_kind=kind,
        storage_key=f"uploads/test/{user_id}/{kind.value}",
        mime_type="image/jpeg" if kind == AssetKind.IMAGE else "audio/mpeg",
        visibility=AssetVisibility.PRIVATE,
        status=AssetStatus.READY,
    )
    db.add(a)
    await db.commit()
    await db.refresh(a)
    return a


async def _make_art_style(
    db: AsyncSession,
    *,
    owner_user_id: int | None = None,
    access_level: AssetAccessLevel = AssetAccessLevel.FREE,
    status: ArtStyleStatus = ArtStyleStatus.ACTIVE,
) -> ArtStyle:
    s = ArtStyle(
        owner_user_id=owner_user_id,
        name="Test Style",
        description="desc",
        access_level=access_level,
        sort_order=0,
        status=status,
    )
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return s


async def _make_character(
    db: AsyncSession,
    *,
    owner_user_id: int | None = None,
    is_default: bool = False,
    status: LibraryItemStatus = LibraryItemStatus.ACTIVE,
) -> Character:
    c = Character(
        owner_user_id=owner_user_id,
        name="Test Character",
        source_type=AssetSourceType.AI_GENERATED,
        is_default=is_default,
        status=status,
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return c


async def _make_voice(
    db: AsyncSession,
    *,
    owner_user_id: int | None = None,
    is_default: bool = False,
    status: LibraryItemStatus = LibraryItemStatus.ACTIVE,
) -> Voice:
    v = Voice(
        owner_user_id=owner_user_id,
        name="Test Voice",
        source_type=AssetSourceType.USER_UPLOAD,
        is_default=is_default,
        status=status,
    )
    db.add(v)
    await db.commit()
    await db.refresh(v)
    return v


# ---------------------------------------------------------------------------
# Character
# ---------------------------------------------------------------------------

@patch("app.service.asset.service.generation_task.create_task", new_callable=AsyncMock)
@patch("app.service.asset.service.entitlement_service.assert_can_create", new_callable=AsyncMock)
async def test_create_character_basic(mock_entitlement, mock_create_task, db: AsyncSession):
    mock_entitlement.return_value = None
    mock_create_task.return_value = AsyncMock()

    style = await _make_art_style(db)

    result = await asset_service.create_character(
        db,
        user_id=1,
        payload=CharacterCreateRequest(
            name="小雨",
            art_style_id=style.id,
            generation_prompt="6 岁女孩，活泼勇敢",
        ),
    )

    assert result.name == "小雨"
    assert result.owner_user_id == 1
    assert result.art_style_id == style.id
    assert result.source_type == AssetSourceType.AI_GENERATED
    mock_entitlement.assert_called_once()
    mock_create_task.assert_called_once()


@patch("app.service.asset.service.generation_task.create_task", new_callable=AsyncMock)
@patch("app.service.asset.service.entitlement_service.assert_can_create", new_callable=AsyncMock)
async def test_create_character_allows_without_art_style(mock_entitlement, mock_create_task, db: AsyncSession):
    mock_entitlement.return_value = None
    mock_create_task.return_value = AsyncMock()

    result = await asset_service.create_character(
        db,
        user_id=1,
        payload=CharacterCreateRequest(
            name="No Style",
            generation_prompt="描述",
        ),
    )

    assert result.art_style_id is None
    mock_create_task.assert_called_once()
    task_payload = mock_create_task.call_args.args[1]
    assert task_payload.input_payload["art_style_id"] is None


@patch("app.service.asset.service.generation_task.create_task", new_callable=AsyncMock)
@patch("app.service.asset.service.entitlement_service.assert_can_create", new_callable=AsyncMock)
async def test_create_character_with_reference_character(mock_entitlement, mock_create_task, db: AsyncSession):
    mock_entitlement.return_value = None
    mock_create_task.return_value = AsyncMock()

    ref = await _make_character(db, owner_user_id=1)
    ref.image_url = "https://cdn.example.com/ref.png"
    style = await _make_art_style(db)
    await db.commit()

    result = await asset_service.create_character(
        db,
        user_id=1,
        payload=CharacterCreateRequest(
            name="With Ref",
            art_style_id=style.id,
            generation_prompt="描述",
            reference_character_id=ref.id,
        ),
    )

    assert result.reference_character_id == ref.id


@patch("app.service.asset.service.generation_task.create_task", new_callable=AsyncMock)
@patch("app.service.asset.service.entitlement_service.assert_can_create", new_callable=AsyncMock)
async def test_create_character_with_uploaded_reference_image_returns_image_url(mock_entitlement, mock_create_task, db: AsyncSession):
    mock_entitlement.return_value = None
    mock_create_task.return_value = AsyncMock()

    asset = await _make_user_asset(db, user_id=1)
    consent = await privacy_service.record_upload_consent(
        db,
        user_id=1,
        payload=UploadConsentCreate(
            target_type=UploadConsentTargetType.CHARACTER_REFERENCE_IMAGE,
            target_id=asset.id,
            confirmed_rights=True,
            confirmed_privacy=True,
        ),
    )

    result = await asset_service.create_character(
        db,
        user_id=1,
        payload=CharacterCreateRequest(
            name="Uploaded Ref",
            reference_asset_id=asset.id,
            upload_consent_id=consent.id,
        ),
    )

    assert result.image_url
    assert result.image_url.endswith(asset.storage_key)
    assert result.generation_prompt is None
    assert result.source_type == AssetSourceType.USER_UPLOAD
    mock_create_task.assert_not_called()


@patch("app.service.asset.service.generation_task.create_task", new_callable=AsyncMock)
@patch("app.service.asset.service.entitlement_service.assert_can_create", new_callable=AsyncMock)
async def test_create_character_rejects_ai_generated_without_prompt(mock_entitlement, mock_create_task, db: AsyncSession):
    mock_entitlement.return_value = None

    with pytest.raises(HTTPException) as exc:
        await asset_service.create_character(
            db,
            user_id=1,
            payload=CharacterCreateRequest(
                name="No Prompt",
                generation_prompt=" ",
            ),
        )

    assert exc.value.status_code == 400
    mock_create_task.assert_not_called()


@patch("app.service.asset.service.generation_task.create_task", new_callable=AsyncMock)
@patch("app.service.asset.service.entitlement_service.assert_can_create", new_callable=AsyncMock)
async def test_create_character_rejects_reference_character_from_other_user(mock_entitlement, mock_create_task, db: AsyncSession):
    mock_entitlement.return_value = None

    _ref = await _make_character(db, owner_user_id=999)
    style = await _make_art_style(db)

    with pytest.raises(HTTPException) as exc:
        await asset_service.create_character(
            db,
            user_id=1,
            payload=CharacterCreateRequest(
                name="Steal Ref",
                art_style_id=style.id,
                generation_prompt="描述",
                reference_character_id=_ref.id,
            ),
        )
    assert exc.value.status_code == 404


@patch("app.service.asset.service.generation_task.create_task", new_callable=AsyncMock)
@patch("app.service.asset.service.entitlement_service.assert_can_create", new_callable=AsyncMock)
@patch("app.service.asset.service.entitlement_service.assert_can_use_vip_resource", new_callable=AsyncMock)
async def test_create_character_rejects_vip_system_style_for_free_user(
    mock_vip, mock_entitlement, mock_create_task, db: AsyncSession
):
    mock_entitlement.return_value = None
    mock_vip.side_effect = HTTPException(status_code=403, detail="需要会员")

    style = await _make_art_style(db, access_level=AssetAccessLevel.VIP)

    with pytest.raises(HTTPException) as exc:
        await asset_service.create_character(
            db,
            user_id=1,
            payload=CharacterCreateRequest(
                name="VIP Style",
                art_style_id=style.id,
                generation_prompt="描述",
            ),
        )
    assert exc.value.status_code == 403


@patch("app.service.asset.service.generation_task.create_task", new_callable=AsyncMock)
@patch("app.service.asset.service.entitlement_service.assert_can_create", new_callable=AsyncMock)
@patch("app.service.asset.service.entitlement_service.assert_can_use_vip_resource", new_callable=AsyncMock)
async def test_create_character_rejects_vip_system_reference_for_free_user(
    mock_vip, mock_entitlement, mock_create_task, db: AsyncSession
):
    mock_entitlement.return_value = None
    mock_vip.side_effect = HTTPException(status_code=403, detail="需要会员")

    ref = await _make_character(db, owner_user_id=None)
    ref.image_url = "https://cdn.example.com/vip-ref.png"
    ref.access_level = AssetAccessLevel.VIP
    await db.commit()

    with pytest.raises(HTTPException) as exc:
        await asset_service.create_character(
            db,
            user_id=1,
            payload=CharacterCreateRequest(
                name="VIP Ref",
                reference_character_id=ref.id,
                generation_prompt="描述",
            ),
        )

    assert exc.value.status_code == 403
    mock_vip.assert_called_once()
    mock_create_task.assert_not_called()


@patch("app.service.asset.service.generation_task.create_task", new_callable=AsyncMock)
@patch("app.service.asset.service.entitlement_service.assert_can_create", new_callable=AsyncMock)
async def test_create_character_rejects_invalid_category_code(mock_entitlement, mock_create_task, db: AsyncSession):
    mock_entitlement.return_value = None

    with pytest.raises(HTTPException) as exc:
        await asset_service.create_character(
            db,
            user_id=1,
            payload=CharacterCreateRequest(
                name="Bad Category",
                generation_prompt="描述",
                category_code="missing",
            ),
        )

    assert exc.value.status_code == 400
    mock_create_task.assert_not_called()


@patch("app.service.asset.service.generation_task.create_task", new_callable=AsyncMock)
@patch("app.service.asset.service.entitlement_service.assert_can_create", new_callable=AsyncMock)
async def test_create_character_allows_valid_category_code(mock_entitlement, mock_create_task, db: AsyncSession):
    mock_entitlement.return_value = None
    mock_create_task.return_value = AsyncMock()
    db.add(
        TaxonomyItem(
            type=TaxonomyType.CHARACTER_CATEGORY,
            code="child",
            name="儿童",
            status=TaxonomyItemStatus.ACTIVE,
        )
    )
    await db.commit()

    result = await asset_service.create_character(
        db,
        user_id=1,
        payload=CharacterCreateRequest(
            name="Good Category",
            generation_prompt="描述",
            category_code="child",
        ),
    )

    assert result.category_code == "child"
    mock_create_task.assert_called_once()


async def test_get_character_owner_only(db: AsyncSession):
    c = await _make_character(db, owner_user_id=1)

    result = await asset_service.get_character(db, c.id, user_id=1)
    assert result.id == c.id

    with pytest.raises(HTTPException) as exc:
        await asset_service.get_character(db, c.id, user_id=2)
    assert exc.value.status_code == 404


async def test_get_character_system_accessible_by_anyone(db: AsyncSession):
    c = await _make_character(db, owner_user_id=None)

    result = await asset_service.get_character(db, c.id, user_id=1)
    assert result.id == c.id

    result_no_user = await asset_service.get_character(db, c.id, user_id=None)
    assert result_no_user.id == c.id


async def test_update_character(db: AsyncSession):
    c = await _make_character(db, owner_user_id=1)

    result = await asset_service.update_character(
        db, user_id=1, character_id=c.id, payload=CharacterUpdateRequest(name="Updated Name")
    )
    assert result.name == "Updated Name"


async def test_update_character_rejects_non_owner(db: AsyncSession):
    c = await _make_character(db, owner_user_id=1)

    with pytest.raises(HTTPException) as exc:
        await asset_service.update_character(
            db, user_id=2, character_id=c.id, payload=CharacterUpdateRequest(name="Hacked")
        )
    assert exc.value.status_code == 403


async def test_delete_character_soft_delete(db: AsyncSession):
    c = await _make_character(db, owner_user_id=1, is_default=True)

    await asset_service.delete_character(db, user_id=1, character_id=c.id)

    # character still exists but status changed
    await db.refresh(c)
    assert c.status == LibraryItemStatus.DELETED
    assert c.is_default is False


async def test_delete_character_rejects_non_owner(db: AsyncSession):
    c = await _make_character(db, owner_user_id=1)

    with pytest.raises(HTTPException) as exc:
        await asset_service.delete_character(db, user_id=2, character_id=c.id)
    assert exc.value.status_code == 403


async def test_set_default_character(db: AsyncSession):
    c1 = await _make_character(db, owner_user_id=1, is_default=True)
    c2 = await _make_character(db, owner_user_id=1, is_default=False)

    result = await asset_service.set_default_character(db, user_id=1, character_id=c2.id)
    assert result.is_default is True

    await db.refresh(c1)
    assert c1.is_default is False


async def test_set_default_character_rejects_non_owner(db: AsyncSession):
    c = await _make_character(db, owner_user_id=1)

    with pytest.raises(HTTPException) as exc:
        await asset_service.set_default_character(db, user_id=2, character_id=c.id)
    assert exc.value.status_code == 403


# ---------------------------------------------------------------------------
# Character list
# ---------------------------------------------------------------------------

async def test_list_characters_filters_by_owner(db: AsyncSession):
    await _make_character(db, owner_user_id=1)
    await _make_character(db, owner_user_id=2)
    await _make_character(db, owner_user_id=None)

    result = await asset_service.list_characters(db, user_id=1)
    assert all(c.owner_user_id in {None, 1} for c in result.items)
    assert result.total >= 2


async def test_list_characters_excludes_deleted(db: AsyncSession):
    await _make_character(db, owner_user_id=1, status=LibraryItemStatus.ACTIVE)
    await _make_character(db, owner_user_id=1, status=LibraryItemStatus.DELETED)

    result = await asset_service.list_characters(db, user_id=1)
    assert all(c.status == LibraryItemStatus.ACTIVE for c in result.items)


# ---------------------------------------------------------------------------
# Voice
# ---------------------------------------------------------------------------

@patch("app.service.asset.service.entitlement_service.assert_can_create", new_callable=AsyncMock)
async def test_create_voice_basic(mock_entitlement, db: AsyncSession):
    mock_entitlement.return_value = None

    result = await asset_service.create_voice(
        db,
        user_id=1,
        payload=VoiceCreateRequest(
            name="Mom Voice",
            duration_seconds=12,
        )
    )

    assert result.name == "Mom Voice"
    assert result.owner_user_id == 1
    assert result.duration_seconds == 12
    assert result.sample_url is None


async def test_update_voice(db: AsyncSession):
    v = await _make_voice(db, owner_user_id=1)

    result = await asset_service.update_voice(db, user_id=1, voice_id=v.id, payload=VoiceUpdateRequest(name="Renamed"))
    assert result.name == "Renamed"


async def test_delete_voice_soft_delete(db: AsyncSession):
    v = await _make_voice(db, owner_user_id=1, is_default=True)

    await asset_service.delete_voice(db, user_id=1, voice_id=v.id)

    await db.refresh(v)
    assert v.status == LibraryItemStatus.DELETED
    assert v.is_default is False


async def test_set_default_voice(db: AsyncSession):
    v1 = await _make_voice(db, owner_user_id=1, is_default=True)
    v2 = await _make_voice(db, owner_user_id=1, is_default=False)

    result = await asset_service.set_default_voice(db, user_id=1, voice_id=v2.id)
    assert result.is_default is True

    await db.refresh(v1)
    assert v1.is_default is False


async def test_list_voices_excludes_deleted(db: AsyncSession):
    await _make_voice(db, owner_user_id=1, status=LibraryItemStatus.ACTIVE)
    await _make_voice(db, owner_user_id=1, status=LibraryItemStatus.DELETED)

    result = await asset_service.list_voices(db, user_id=1)
    assert all(v.status == LibraryItemStatus.ACTIVE for v in result.items)


# ---------------------------------------------------------------------------
# assert_asset_usable
# ---------------------------------------------------------------------------

async def test_assert_asset_usable_character(db: AsyncSession):
    c = await _make_character(db, owner_user_id=1)

    dto = await asset_service.assert_asset_usable(db, user_id=1, asset_type="character", asset_id=c.id)
    assert dto.asset_id == c.id
    assert dto.usable is True
    assert dto.asset_type == "character"


async def test_assert_asset_usable_deleted_character(db: AsyncSession):
    c = await _make_character(db, owner_user_id=1)

    c.status = LibraryItemStatus.DELETED
    await db.commit()

    dto = await asset_service.assert_asset_usable(db, user_id=1, asset_type="character", asset_id=c.id)
    assert dto.usable is False


@patch("app.service.asset.service.entitlement_service.assert_can_use_vip_resource", new_callable=AsyncMock)
async def test_assert_asset_usable_vip_system_character(mock_vip, db: AsyncSession):
    mock_vip.return_value = None

    c = await _make_character(db, owner_user_id=None)
    c.access_level = AssetAccessLevel.VIP
    await db.commit()

    dto = await asset_service.assert_asset_usable(db, user_id=1, asset_type="character", asset_id=c.id)
    assert dto.access_level == AssetAccessLevel.VIP
    mock_vip.assert_called_once()


async def test_assert_asset_usable_voice_ready(db: AsyncSession):
    v = await _make_voice(db, owner_user_id=1)

    dto = await asset_service.assert_asset_usable(db, user_id=1, asset_type="voice", asset_id=v.id)
    assert dto.usable is True


async def test_admin_system_voice_crud(db: AsyncSession):
    created = await asset_service.create_system_voice(
        db,
        SystemVoiceCreate(
            name="温柔姐姐",
            voice_style_code="gentle_sister",
            emotion_type="gentle",
            sample_url="https://example.com/gentle.mp3",
            duration_seconds=32,
            access_level=AssetAccessLevel.VIP,
        ),
    )
    assert created.owner_user_id is None
    assert created.source_type == AssetSourceType.SYSTEM
    assert created.voice_style_code == "gentle_sister"
    assert created.emotion_type == "gentle"
    assert created.access_level == AssetAccessLevel.VIP

    updated = await asset_service.update_system_voice(
        db,
        created.id,
        SystemVoiceUpdate(name="温柔姐姐新版", status=LibraryItemStatus.DISABLED),
    )
    assert updated.name == "温柔姐姐新版"
    assert updated.status == LibraryItemStatus.DISABLED

    listed = await asset_service.list_admin_system_voices(db)
    assert any(voice.id == created.id for voice in listed.items)

    await asset_service.delete_system_voice(db, created.id)
    with pytest.raises(HTTPException) as exc:
        await asset_service.get_admin_system_voice(db, created.id)
    assert exc.value.status_code == 404


async def test_create_system_voice_sample_uses_audio_task(db: AsyncSession):
    created = await asset_service.create_system_voice(
        db,
        SystemVoiceCreate(name="知妙", voice_style_code="zhimiao_emo", emotion_type="happy"),
    )

    task = await asset_service.create_system_voice_sample_task(
        db,
        SystemVoiceSampleGenerateRequest(
            voice_id=created.id,
            voice_style_code="zhimiao_emo",
            emotion_type="happy",
            sample_text="你好呀",
        ),
    )

    assert task.task_type == GenerationTaskType.AUDIO
    assert task.owner_type == "voice"
    assert task.owner_id == created.id


@patch("app.service.ai_provider.service.settings.AI_PROVIDER_AUDIO", "aliyun")
@patch("app.service.ai_provider.service._generate_audio_with_provider", new_callable=AsyncMock)
@patch("app.service.storage.save_generated_data_url", new_callable=AsyncMock)
async def test_run_system_voice_sample_task_updates_voice_sample_url(mock_save, mock_generate, db: AsyncSession):
    created = await asset_service.create_system_voice(
        db,
        SystemVoiceCreate(name="知妙", voice_style_code="zhimiao_emo", emotion_type="happy"),
    )
    task = GenerationTask(
        task_type=GenerationTaskType.AUDIO,
        owner_type="voice",
        owner_id=created.id,
        status=GenerationTaskStatus.RUNNING,
        input_payload={
            "voice_id": created.id,
            "voice_style_code": "zhimiao_emo",
            "emotion_type": "happy",
            "sample_text": "你好呀",
        },
    )
    db.add(task)
    await db.flush()
    mock_generate.return_value = "data:audio/wav;base64,abc"
    mock_save.return_value.id = 101
    mock_save.return_value.url = "https://cdn.example.com/voice.wav"

    await asset_service.run_system_voice_sample_task(db, task)

    mock_generate.assert_awaited_once()
    assert mock_generate.await_args.args[:3] == ("aliyun", "aliyun-nls-tts", "你好呀")
    voice = await db.get(Voice, created.id)
    await db.refresh(task)
    assert voice is not None
    assert voice.sample_url == "https://cdn.example.com/voice.wav"
    assert task.status == GenerationTaskStatus.SUCCEEDED
    assert task.output_payload == {
        "asset_id": 101,
        "audio_url": "https://cdn.example.com/voice.wav",
        "sample_url": "https://cdn.example.com/voice.wav",
        "voice_id": created.id,
    }


async def test_assert_asset_usable_unsupported_type(db: AsyncSession):
    with pytest.raises(HTTPException) as exc:
        await asset_service.assert_asset_usable(db, user_id=1, asset_type="unknown", asset_id=1)
    assert exc.value.status_code == 400


# ---------------------------------------------------------------------------
# Art Style
# ---------------------------------------------------------------------------

async def test_list_art_styles(db: AsyncSession):
    await _make_art_style(db)
    await _make_art_style(db, owner_user_id=1)

    result = await asset_service.list_art_styles(db, user_id=1)
    assert result.total >= 2


async def test_list_art_styles_excludes_inactive(db: AsyncSession):
    await _make_art_style(db, status=ArtStyleStatus.ACTIVE)
    await _make_art_style(db, status=ArtStyleStatus.INACTIVE)

    result = await asset_service.list_art_styles(db)
    assert all(s.status == ArtStyleStatus.ACTIVE for s in result.items)


async def test_get_art_style_owner_check(db: AsyncSession):
    style = await _make_art_style(db, owner_user_id=1)

    result = await asset_service.get_art_style(db, style.id, user_id=1)
    assert result.id == style.id

    with pytest.raises(HTTPException) as exc:
        await asset_service.get_art_style(db, style.id, user_id=2)
    assert exc.value.status_code == 404


async def test_create_custom_art_style(db: AsyncSession):
    from app.schema.asset import CustomArtStyleCreate

    result = await asset_service.create_custom_art_style(
        db,
        user_id=1,
        payload=CustomArtStyleCreate(name="My Style", description="warm watercolor"),
    )
    assert result.name == "My Style"
    assert result.owner_user_id == 1
    assert result.access_level == AssetAccessLevel.FREE
