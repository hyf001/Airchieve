from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.model.privacy import (
    PrivacyAction,
    PrivacyConfirmation,
    PrivacyDeletionPolicy,
    PrivacyUploadConsent,
    PrivacyVisibility,
    PrivacyVisibilityPolicy,
    UploadConsentTargetType,
)
from app.schema.privacy import (
    PrivacyConfirmationCreate,
    PrivacyConfirmationRead,
    PrivacyFlagsRead,
    PrivacyTarget,
    UploadConsentCreate,
    UploadConsentRead,
)

PERSONAL_ASSET_FLAGS = {"personal_character", "personal_voice"}


def _risk_flags_for_policy(policy: PrivacyVisibilityPolicy | None, target_type: str) -> list[str]:
    candidate_type = policy.target_type if policy else target_type
    if candidate_type == "character":
        return ["personal_character"]
    if candidate_type == "voice":
        return ["personal_voice"]
    return []


async def record_upload_consent(
    db: AsyncSession,
    user_id: int,
    payload: UploadConsentCreate,
    *,
    ip_hash: str | None = None,
    user_agent: str | None = None,
) -> UploadConsentRead:
    if not payload.confirmed_rights or not payload.confirmed_privacy:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="必须确认素材权利和隐私提示")
    consent = PrivacyUploadConsent(
        user_id=user_id,
        target_type=payload.target_type,
        target_id=payload.target_id,
        consent_text_version=payload.consent_text_version,
        confirmed_rights=payload.confirmed_rights,
        confirmed_privacy=payload.confirmed_privacy,
        ip_hash=ip_hash,
        user_agent=user_agent,
        created_at=datetime.now(timezone.utc),
    )
    db.add(consent)
    await db.commit()
    await db.refresh(consent)
    return UploadConsentRead.model_validate(consent)


async def record_privacy_confirmation(
    db: AsyncSession,
    user_id: int,
    payload: PrivacyConfirmationCreate,
) -> PrivacyConfirmationRead:
    confirmation = PrivacyConfirmation(
        user_id=user_id,
        action=payload.action,
        target_type=payload.target.target_type,
        target_id=payload.target.target_id,
        risk_flags=payload.risk_flags,
        confirmation_text_version=payload.confirmation_text_version,
        created_at=datetime.now(timezone.utc),
    )
    db.add(confirmation)
    await db.commit()
    await db.refresh(confirmation)
    return PrivacyConfirmationRead.model_validate(confirmation)


async def assert_privacy_confirmation(
    db: AsyncSession,
    *,
    user_id: int,
    confirmation_id: int | None,
    action: PrivacyAction,
    target: PrivacyTarget,
) -> None:
    if confirmation_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="必须先确认隐私风险")
    confirmation = await db.get(PrivacyConfirmation, confirmation_id)
    if (
        confirmation is None
        or confirmation.user_id != user_id
        or confirmation.action != action
        or confirmation.target_type != target.target_type
        or confirmation.target_id != target.target_id
    ):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="隐私风险确认无效")


async def get_privacy_flags(
    db: AsyncSession,
    target: PrivacyTarget,
    *,
    user_id: int | None = None,
    action: PrivacyAction | None = None,
) -> PrivacyFlagsRead:
    policy_result = await db.execute(
        select(PrivacyVisibilityPolicy)
        .where(PrivacyVisibilityPolicy.target_type == target.target_type, PrivacyVisibilityPolicy.target_id == target.target_id)
        .order_by(PrivacyVisibilityPolicy.created_at.desc())
        .limit(1)
    )
    policy = policy_result.scalar_one_or_none()

    confirmation_conditions = [
        PrivacyConfirmation.target_type == target.target_type,
        PrivacyConfirmation.target_id == target.target_id,
    ]
    if user_id is not None:
        confirmation_conditions.append(PrivacyConfirmation.user_id == user_id)
    if action is not None:
        confirmation_conditions.append(PrivacyConfirmation.action == action)
    confirmation_result = await db.execute(
        select(PrivacyConfirmation).where(*confirmation_conditions).order_by(PrivacyConfirmation.created_at.desc()).limit(1)
    )
    latest = confirmation_result.scalar_one_or_none()
    risk_flags = latest.risk_flags if latest is not None else _risk_flags_for_policy(policy, target.target_type)
    requires_confirmation = bool(PERSONAL_ASSET_FLAGS.intersection(risk_flags)) and latest is None
    return PrivacyFlagsRead(
        target_type=target.target_type,
        target_id=target.target_id,
        risk_flags=risk_flags,
        requires_confirmation=requires_confirmation,
        latest_confirmation_id=latest.id if latest else None,
        visibility=policy.visibility if policy else PrivacyVisibility.PRIVATE,
        deletion_policy=policy.deletion_policy if policy else PrivacyDeletionPolicy.SOFT_DELETE,
    )


async def set_visibility_policy(
    db: AsyncSession,
    *,
    user_id: int,
    target_type: str,
    target_id: int,
    visibility: PrivacyVisibility = PrivacyVisibility.PRIVATE,
    deletion_policy: PrivacyDeletionPolicy = PrivacyDeletionPolicy.SOFT_DELETE,
) -> None:
    result = await db.execute(
        select(PrivacyVisibilityPolicy)
        .where(PrivacyVisibilityPolicy.target_type == target_type, PrivacyVisibilityPolicy.target_id == target_id)
        .order_by(PrivacyVisibilityPolicy.created_at.desc())
        .limit(1)
    )
    policy = result.scalar_one_or_none()
    if policy is None:
        policy = PrivacyVisibilityPolicy(
            target_type=target_type,
            target_id=target_id,
            owner_user_id=user_id,
            visibility=visibility,
            deletion_policy=deletion_policy,
        )
        db.add(policy)
    else:
        policy.owner_user_id = user_id
        policy.visibility = visibility
        policy.deletion_policy = deletion_policy
    await db.flush()


async def assert_upload_consent(
    db: AsyncSession,
    *,
    user_id: int,
    consent_id: int | None,
    target_type: UploadConsentTargetType,
    target_id: int | None = None,
) -> None:
    if consent_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="必须先确认上传素材授权")
    consent = await db.get(PrivacyUploadConsent, consent_id)
    if (
        consent is None
        or consent.user_id != user_id
        or consent.target_type != target_type
        or not consent.confirmed_rights
        or not consent.confirmed_privacy
    ):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="上传素材授权确认无效")
    if target_id is not None and consent.target_id not in {None, target_id}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="上传素材授权目标不匹配")
