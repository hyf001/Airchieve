"""Tests for privacy service: upload consent, confirmation, visibility policy, flags."""

from datetime import datetime, timezone

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.model.privacy import (
    PrivacyAction,
    PrivacyDeletionPolicy,
    PrivacyVisibility,
    PrivacyVisibilityPolicy,
    UploadConsentTargetType,
)
from app.schema.privacy import PrivacyConfirmationCreate, PrivacyTarget, UploadConsentCreate
from app.service import privacy as privacy_service


# ---------------------------------------------------------------------------
# record_upload_consent
# ---------------------------------------------------------------------------

async def test_record_upload_consent_success(db: AsyncSession):
    result = await privacy_service.record_upload_consent(
        db,
        user_id=1,
        payload=UploadConsentCreate(
            target_type=UploadConsentTargetType.CHARACTER_REFERENCE_IMAGE,
            confirmed_rights=True,
            confirmed_privacy=True,
        ),
    )

    assert result.user_id == 1
    assert result.target_type == UploadConsentTargetType.CHARACTER_REFERENCE_IMAGE
    assert result.confirmed_rights is True
    assert result.confirmed_privacy is True


async def test_record_upload_consent_rejects_unconfirmed_rights(db: AsyncSession):
    with pytest.raises(HTTPException) as exc:
        await privacy_service.record_upload_consent(
            db,
            user_id=1,
            payload=UploadConsentCreate(
                target_type=UploadConsentTargetType.CHARACTER_REFERENCE_IMAGE,
                confirmed_rights=False,
                confirmed_privacy=True,
            ),
        )
    assert exc.value.status_code == 400


async def test_record_upload_consent_rejects_unconfirmed_privacy(db: AsyncSession):
    with pytest.raises(HTTPException) as exc:
        await privacy_service.record_upload_consent(
            db,
            user_id=1,
            payload=UploadConsentCreate(
                target_type=UploadConsentTargetType.VOICE_SAMPLE,
                confirmed_rights=True,
                confirmed_privacy=False,
            ),
        )
    assert exc.value.status_code == 400


async def test_record_upload_consent_stores_ip_and_user_agent(db: AsyncSession):
    result = await privacy_service.record_upload_consent(
        db,
        user_id=1,
        payload=UploadConsentCreate(
            target_type=UploadConsentTargetType.VOICE_SAMPLE,
            confirmed_rights=True,
            confirmed_privacy=True,
        ),
        ip_hash="abc123",
        user_agent="TestBrowser/1.0",
    )

    assert result.id is not None
    # Verify the record was stored with metadata
    from app.model.privacy import PrivacyUploadConsent

    record = await db.get(PrivacyUploadConsent, result.id)
    assert record is not None
    assert record.ip_hash == "abc123"
    assert record.user_agent == "TestBrowser/1.0"


# ---------------------------------------------------------------------------
# record_privacy_confirmation
# ---------------------------------------------------------------------------

async def test_record_privacy_confirmation_success(db: AsyncSession):
    result = await privacy_service.record_privacy_confirmation(
        db,
        user_id=1,
        payload=PrivacyConfirmationCreate(
            action=PrivacyAction.SHARE,
            target=PrivacyTarget(target_type="book", target_id=42),
            risk_flags=["personal_character", "personal_voice"],
        ),
    )

    assert result.user_id == 1
    assert result.action == PrivacyAction.SHARE
    assert result.target_type == "book"
    assert result.target_id == 42
    assert "personal_character" in result.risk_flags


async def test_record_privacy_confirmation_export(db: AsyncSession):
    result = await privacy_service.record_privacy_confirmation(
        db,
        user_id=1,
        payload=PrivacyConfirmationCreate(
            action=PrivacyAction.EXPORT,
            target=PrivacyTarget(target_type="book", target_id=99),
        ),
    )

    assert result.action == PrivacyAction.EXPORT
    assert result.target_id == 99


# ---------------------------------------------------------------------------
# get_privacy_flags
# ---------------------------------------------------------------------------

async def test_get_privacy_flags_requires_confirmation_for_personal_character(db: AsyncSession):
    policy = PrivacyVisibilityPolicy(
        target_type="character",
        target_id=10,
        owner_user_id=1,
    )
    db.add(policy)
    await db.commit()

    flags = await privacy_service.get_privacy_flags(
        db,
        PrivacyTarget(target_type="character", target_id=10),
        user_id=1,
    )

    assert flags.risk_flags == ["personal_character"]
    assert flags.requires_confirmation is True
    assert flags.visibility == PrivacyVisibility.PRIVATE


async def test_get_privacy_flags_no_confirmation_needed_after_confirmed(db: AsyncSession):
    policy = PrivacyVisibilityPolicy(
        target_type="voice",
        target_id=20,
        owner_user_id=1,
    )
    db.add(policy)
    await db.commit()

    # Record a confirmation
    await privacy_service.record_privacy_confirmation(
        db,
        user_id=1,
        payload=PrivacyConfirmationCreate(
            action=PrivacyAction.SHARE,
            target=PrivacyTarget(target_type="voice", target_id=20),
            risk_flags=["personal_voice"],
        ),
    )

    flags = await privacy_service.get_privacy_flags(
        db,
        PrivacyTarget(target_type="voice", target_id=20),
        user_id=1,
        action=PrivacyAction.SHARE,
    )

    assert flags.risk_flags == ["personal_voice"]
    assert flags.requires_confirmation is False
    assert flags.latest_confirmation_id is not None


async def test_get_privacy_flags_no_policy_defaults_to_private(db: AsyncSession):
    flags = await privacy_service.get_privacy_flags(
        db,
        PrivacyTarget(target_type="book", target_id=999),
        user_id=1,
    )

    assert flags.visibility == PrivacyVisibility.PRIVATE
    assert flags.deletion_policy == PrivacyDeletionPolicy.SOFT_DELETE
    assert flags.risk_flags == []
    assert flags.requires_confirmation is False


async def test_get_privacy_flags_filtered_by_action(db: AsyncSession):
    # Create a SHARE confirmation
    await privacy_service.record_privacy_confirmation(
        db,
        user_id=1,
        payload=PrivacyConfirmationCreate(
            action=PrivacyAction.SHARE,
            target=PrivacyTarget(target_type="book", target_id=50),
            risk_flags=["personal_character"],
        ),
    )

    # Query for EXPORT action - should not find the SHARE confirmation
    flags = await privacy_service.get_privacy_flags(
        db,
        PrivacyTarget(target_type="book", target_id=50),
        user_id=1,
        action=PrivacyAction.EXPORT,
    )

    # No EXPORT confirmation exists, so requires_confirmation depends on risk_flags
    assert flags.latest_confirmation_id is None


# ---------------------------------------------------------------------------
# set_visibility_policy
# ---------------------------------------------------------------------------

async def test_set_visibility_policy_creates_policy(db: AsyncSession):
    await privacy_service.set_visibility_policy(
        db,
        user_id=1,
        target_type="character",
        target_id=100,
    )

    from sqlalchemy import select

    result = await db.execute(
        select(PrivacyVisibilityPolicy).where(
            PrivacyVisibilityPolicy.target_type == "character",
            PrivacyVisibilityPolicy.target_id == 100,
        )
    )
    policy = result.scalar_one_or_none()
    assert policy is not None
    assert policy.visibility == PrivacyVisibility.PRIVATE
    assert policy.deletion_policy == PrivacyDeletionPolicy.SOFT_DELETE


async def test_set_visibility_policy_custom_visibility(db: AsyncSession):
    await privacy_service.set_visibility_policy(
        db,
        user_id=1,
        target_type="voice",
        target_id=200,
        visibility=PrivacyVisibility.SHARED_LINK,
        deletion_policy=PrivacyDeletionPolicy.RETAIN_SNAPSHOT,
    )

    from sqlalchemy import select

    result = await db.execute(
        select(PrivacyVisibilityPolicy).where(
            PrivacyVisibilityPolicy.target_type == "voice",
            PrivacyVisibilityPolicy.target_id == 200,
        )
    )
    policy = result.scalar_one()
    assert policy.visibility == PrivacyVisibility.SHARED_LINK
    assert policy.deletion_policy == PrivacyDeletionPolicy.RETAIN_SNAPSHOT


async def test_set_visibility_policy_updates_existing_policy(db: AsyncSession):
    """Verify that calling set_visibility_policy twice updates the existing target policy."""

    await privacy_service.set_visibility_policy(db, user_id=1, target_type="character", target_id=300)
    await db.commit()

    await privacy_service.set_visibility_policy(
        db,
        user_id=1,
        target_type="character",
        target_id=300,
        visibility=PrivacyVisibility.PUBLIC,
    )
    await db.commit()

    from sqlalchemy import select

    result = await db.execute(
        select(PrivacyVisibilityPolicy).where(
            PrivacyVisibilityPolicy.target_type == "character",
            PrivacyVisibilityPolicy.target_id == 300,
        )
    )
    policies = result.scalars().all()
    assert len(policies) == 1

    # get_privacy_flags should pick the latest
    flags = await privacy_service.get_privacy_flags(
        db, PrivacyTarget(target_type="character", target_id=300)
    )
    assert flags.visibility == PrivacyVisibility.PUBLIC


# ---------------------------------------------------------------------------
# assert_upload_consent
# ---------------------------------------------------------------------------

async def test_assert_upload_consent_success(db: AsyncSession):
    consent = await privacy_service.record_upload_consent(
        db,
        user_id=1,
        payload=UploadConsentCreate(
            target_type=UploadConsentTargetType.VOICE_SAMPLE,
            target_id=42,
            confirmed_rights=True,
            confirmed_privacy=True,
        ),
    )

    # Should not raise
    await privacy_service.assert_upload_consent(
        db,
        user_id=1,
        consent_id=consent.id,
        target_type=UploadConsentTargetType.VOICE_SAMPLE,
        target_id=42,
    )


async def test_assert_upload_consent_rejects_none_consent_id(db: AsyncSession):
    with pytest.raises(HTTPException) as exc:
        await privacy_service.assert_upload_consent(
            db,
            user_id=1,
            consent_id=None,
            target_type=UploadConsentTargetType.VOICE_SAMPLE,
        )
    assert exc.value.status_code == 400
    assert "授权" in exc.value.detail


async def test_assert_upload_consent_rejects_wrong_user(db: AsyncSession):
    consent = await privacy_service.record_upload_consent(
        db,
        user_id=1,
        payload=UploadConsentCreate(
            target_type=UploadConsentTargetType.VOICE_SAMPLE,
            confirmed_rights=True,
            confirmed_privacy=True,
        ),
    )

    with pytest.raises(HTTPException) as exc:
        await privacy_service.assert_upload_consent(
            db,
            user_id=999,
            consent_id=consent.id,
            target_type=UploadConsentTargetType.VOICE_SAMPLE,
        )
    assert exc.value.status_code == 400


async def test_assert_upload_consent_rejects_wrong_target_type(db: AsyncSession):
    consent = await privacy_service.record_upload_consent(
        db,
        user_id=1,
        payload=UploadConsentCreate(
            target_type=UploadConsentTargetType.CHARACTER_REFERENCE_IMAGE,
            confirmed_rights=True,
            confirmed_privacy=True,
        ),
    )

    with pytest.raises(HTTPException) as exc:
        await privacy_service.assert_upload_consent(
            db,
            user_id=1,
            consent_id=consent.id,
            target_type=UploadConsentTargetType.VOICE_SAMPLE,
        )
    assert exc.value.status_code == 400


async def test_assert_upload_consent_rejects_mismatched_target_id(db: AsyncSession):
    consent = await privacy_service.record_upload_consent(
        db,
        user_id=1,
        payload=UploadConsentCreate(
            target_type=UploadConsentTargetType.VOICE_SAMPLE,
            target_id=10,
            confirmed_rights=True,
            confirmed_privacy=True,
        ),
    )

    with pytest.raises(HTTPException) as exc:
        await privacy_service.assert_upload_consent(
            db,
            user_id=1,
            consent_id=consent.id,
            target_type=UploadConsentTargetType.VOICE_SAMPLE,
            target_id=999,
        )
    assert exc.value.status_code == 400
    assert "不匹配" in exc.value.detail


async def test_assert_upload_consent_allows_null_target_id_match(db: AsyncSession):
    """When consent has target_id=None and assertion passes target_id, it should succeed."""
    consent = await privacy_service.record_upload_consent(
        db,
        user_id=1,
        payload=UploadConsentCreate(
            target_type=UploadConsentTargetType.VOICE_SAMPLE,
            target_id=None,
            confirmed_rights=True,
            confirmed_privacy=True,
        ),
    )

    # target_id=None in consent matches any target_id
    await privacy_service.assert_upload_consent(
        db,
        user_id=1,
        consent_id=consent.id,
        target_type=UploadConsentTargetType.VOICE_SAMPLE,
        target_id=42,
    )
