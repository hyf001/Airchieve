import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.model.asset import ArtStyle, AssetAccessLevel, Character, Voice
from app.model.privacy import PrivacyVisibilityPolicy, UploadConsentTargetType
from app.schema.asset import CharacterCreateRequest
from app.schema.privacy import PrivacyTarget, UploadConsentCreate
from app.service import asset as asset_service
from app.service import privacy as privacy_service


async def test_create_character_rejects_vip_system_style_for_free_user(db: AsyncSession):
    style = ArtStyle(
        owner_user_id=None,
        code="vip-watercolor",
        name="VIP watercolor",
        description="VIP style",
        access_level=AssetAccessLevel.VIP,
        sort_order=0,
    )
    db.add(style)
    await db.commit()

    with pytest.raises(HTTPException) as exc_info:
        await asset_service.create_character(
            db,
            user_id=1,
            payload=CharacterCreateRequest(
                name="小雨",
                art_style_id=style.id,
                generation_prompt="6 岁女孩，活泼勇敢",
            ),
        )

    assert exc_info.value.status_code == 403


async def test_assert_asset_usable_allows_active_voice(db: AsyncSession):
    voice = Voice(owner_user_id=1, name="声音")
    db.add(voice)
    await db.commit()

    result = await asset_service.assert_asset_usable(db, user_id=1, asset_type="voice", asset_id=voice.id)

    assert result.usable is True


async def test_assert_asset_usable_allows_system_character_without_moderation(db: AsyncSession):
    character = Character(
        owner_user_id=None,
        name="系统形象",
        source_type="system",
    )
    db.add(character)
    await db.commit()

    result = await asset_service.assert_asset_usable(db, user_id=1, asset_type="character", asset_id=character.id)

    assert result.usable is True


async def test_privacy_flags_require_confirmation_for_personal_voice(db: AsyncSession):
    policy = PrivacyVisibilityPolicy(target_type="voice", target_id=12, owner_user_id=1)
    db.add(policy)
    await db.commit()

    flags = await privacy_service.get_privacy_flags(db, PrivacyTarget(target_type="voice", target_id=12), user_id=1)

    assert flags.risk_flags == ["personal_voice"]
    assert flags.requires_confirmation is True


async def test_upload_consent_must_match_target_type(db: AsyncSession):
    consent = await privacy_service.record_upload_consent(
        db,
        user_id=1,
        payload=UploadConsentCreate(
            target_type=UploadConsentTargetType.CHARACTER_REFERENCE_IMAGE,
            confirmed_rights=True,
            confirmed_privacy=True,
        ),
    )

    with pytest.raises(HTTPException) as exc_info:
        await privacy_service.assert_upload_consent(
            db,
            user_id=1,
            consent_id=consent.id,
            target_type=UploadConsentTargetType.VOICE_SAMPLE,
        )

    assert exc_info.value.status_code == 400
