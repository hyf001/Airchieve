from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.model.account import ChildProfile, ChildProfileStatus
from app.schema.account import ChildProfileCreate, ChildProfileSummary, ChildProfileUpdate
from app.service import entitlement_service
from app.service.account.auth_service import _get_user


async def assert_profile_belongs_to_user(db: AsyncSession, profile_id: str, user_id: str) -> None:
    profile = await db.get(ChildProfile, profile_id)
    if not profile or profile.user_id != user_id or profile.status != ChildProfileStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="儿童档案不存在")


async def get_child_profile(db: AsyncSession, user_id: str, profile_id: str) -> ChildProfile:
    profile = await db.get(ChildProfile, profile_id)
    if not profile or profile.user_id != user_id or profile.status != ChildProfileStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="儿童档案不存在")
    return profile


def _profile_summary(profile: ChildProfile) -> ChildProfileSummary:
    return ChildProfileSummary(
        id=profile.id,
        nickname=profile.nickname,
        age_range_label=profile.age_range_id,
        reading_level_label=profile.reading_level_id,
        is_default=profile.is_default,
        default_character_id=profile.default_character_id,
        default_voice_id=profile.default_voice_id,
        default_art_style_id=profile.default_art_style_id,
    )


async def list_child_profiles(db: AsyncSession, user_id: str) -> list[ChildProfileSummary]:
    result = await db.execute(
        select(ChildProfile)
        .where(ChildProfile.user_id == user_id, ChildProfile.status == ChildProfileStatus.ACTIVE)
        .order_by(ChildProfile.is_default.desc(), ChildProfile.created_at.desc())
    )
    return [_profile_summary(profile) for profile in result.scalars().all()]


async def create_child_profile(db: AsyncSession, user_id: str, payload: ChildProfileCreate) -> ChildProfile:
    await _get_user(db, user_id)
    assert_create = getattr(entitlement_service, "assert_can_create", None)
    if assert_create:
        await assert_create(user_id, "child_profile")
    count = (
        await db.execute(
            select(func.count(ChildProfile.id)).where(
                ChildProfile.user_id == user_id,
                ChildProfile.status == ChildProfileStatus.ACTIVE,
            )
        )
    ).scalar_one()
    profile = ChildProfile(user_id=user_id, is_default=count == 0, **payload.model_dump())
    db.add(profile)
    await db.flush()
    if profile.is_default:
        user = await _get_user(db, user_id)
        user.default_child_profile_id = profile.id
    await db.commit()
    await db.refresh(profile)
    return profile


async def update_child_profile(
    db: AsyncSession,
    user_id: str,
    profile_id: str,
    payload: ChildProfileUpdate,
) -> ChildProfile:
    profile = await get_child_profile(db, user_id, profile_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, key, value)
    await db.commit()
    await db.refresh(profile)
    return profile


async def delete_child_profile(db: AsyncSession, user_id: str, profile_id: str) -> None:
    profile = await get_child_profile(db, user_id, profile_id)
    profile.status = ChildProfileStatus.DELETED
    user = await _get_user(db, user_id)
    if user.default_child_profile_id == profile.id:
        replacement = await db.execute(
            select(ChildProfile)
            .where(
                ChildProfile.user_id == user_id,
                ChildProfile.id != profile_id,
                ChildProfile.status == ChildProfileStatus.ACTIVE,
            )
            .order_by(ChildProfile.created_at.desc())
            .limit(1)
        )
        new_default = replacement.scalar_one_or_none()
        user.default_child_profile_id = new_default.id if new_default else None
        if new_default:
            new_default.is_default = True
    await db.commit()


async def set_default_child_profile(db: AsyncSession, user_id: str, profile_id: str) -> ChildProfile:
    profile = await get_child_profile(db, user_id, profile_id)
    await db.execute(
        update(ChildProfile)
        .where(ChildProfile.user_id == user_id, ChildProfile.status == ChildProfileStatus.ACTIVE)
        .values(is_default=False)
    )
    profile.is_default = True
    user = await _get_user(db, user_id)
    user.default_child_profile_id = profile.id
    await db.commit()
    await db.refresh(profile)
    return profile
