from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.model.asset import (
    ArtStyle,
    ArtStyleStatus,
    Asset,
    AssetAccessLevel,
    AssetKind,
    AssetSourceType,
    AssetStatus,
    Character,
    LibraryItemStatus,
)
from app.model.privacy import UploadConsentTargetType
from app.model.generation_task import GenerationTask, GenerationTaskType
from app.schema.asset import (
    ArtStyleRead,
    CharacterCreateRequest,
    CharacterListRead,
    CharacterRead,
    CharacterSummary,
    CharacterUpdateRequest,
    SystemCharacterCreate,
    SystemCharacterUpdate,
)
from app.schema.entitlement import EntitlementResourceType
from app.schema.generation_task import GenerationTaskCreate
from app.service import entitlement as entitlement_service
from app.service import generation_task
from app.model.taxonomy import TaxonomyType
from app.service.taxonomy import validate_taxonomy_codes
from app.service import storage as storage_service
from app.service.privacy import assert_upload_consent, set_visibility_policy


def _character_summary(character: Character, latest_task: GenerationTask | None = None) -> CharacterSummary:
    values = CharacterSummary.model_validate(character).model_dump()
    values.update(
        generation_task_id=latest_task.id if latest_task else None,
        generation_status=latest_task.status if latest_task else None,
        generation_progress_percent=latest_task.progress_percent if latest_task else None,
        generation_error_message=latest_task.error_message if latest_task else None,
    )
    return CharacterSummary(**values)


async def _latest_character_image_tasks(db: AsyncSession, character_ids: list[int]) -> dict[int, GenerationTask]:
    if not character_ids:
        return {}
    latest_ids_subquery = (
        select(func.max(GenerationTask.id).label("task_id"))
        .where(
            GenerationTask.task_type == GenerationTaskType.CHARACTER_IMAGE,
            GenerationTask.owner_type == "character",
            GenerationTask.owner_id.in_(character_ids),
        )
        .group_by(GenerationTask.owner_id)
        .subquery()
    )
    result = await db.execute(select(GenerationTask).join(latest_ids_subquery, GenerationTask.id == latest_ids_subquery.c.task_id))
    return {task.owner_id: task for task in result.scalars().all()}


async def _latest_character_image_task(db: AsyncSession, character_id: int) -> GenerationTask | None:
    result = await db.execute(
        select(GenerationTask)
        .where(
            GenerationTask.task_type == GenerationTaskType.CHARACTER_IMAGE,
            GenerationTask.owner_type == "character",
            GenerationTask.owner_id == character_id,
        )
        .order_by(GenerationTask.id.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


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
    ]
    if source_type:
        conditions.append(Character.source_type == source_type)
    stmt = select(Character).where(*conditions).order_by(Character.is_default.desc(), Character.created_at.desc())
    result = await db.execute(stmt.offset(offset).limit(limit))
    characters = result.scalars().all()
    latest_tasks = await _latest_character_image_tasks(db, [character.id for character in characters])
    total = await db.scalar(select(func.count()).select_from(Character).where(*conditions))
    return CharacterListRead(
        items=[_character_summary(character, latest_tasks.get(character.id)) for character in characters],
        total=total or 0,
        limit=limit,
        offset=offset,
    )


async def list_admin_system_characters(db: AsyncSession, *, limit: int = 100, offset: int = 0) -> CharacterListRead:
    conditions = [Character.owner_user_id.is_(None), Character.status != LibraryItemStatus.DELETED]
    stmt = select(Character).where(*conditions).order_by(Character.created_at.desc())
    result = await db.execute(stmt.offset(offset).limit(limit))
    characters = result.scalars().all()
    latest_tasks = await _latest_character_image_tasks(db, [character.id for character in characters])
    total = await db.scalar(select(func.count()).select_from(Character).where(*conditions))
    return CharacterListRead(
        items=[_character_summary(character, latest_tasks.get(character.id)) for character in characters],
        total=total or 0,
        limit=limit,
        offset=offset,
    )


async def get_character(db: AsyncSession, character_id: int, *, user_id: int | None = None) -> CharacterRead:
    character = await _get_character_model(db, character_id, user_id=user_id)
    art_style = await db.get(ArtStyle, character.art_style_id) if character.art_style_id else None
    latest_task = await _latest_character_image_task(db, character.id)
    return CharacterRead(
        **_character_summary(character, latest_task).model_dump(),
        reference_character_id=character.reference_character_id,
        generation_prompt=character.generation_prompt,
        art_style=ArtStyleRead.model_validate(art_style) if art_style else None,
    )


async def get_admin_system_character(db: AsyncSession, character_id: int) -> CharacterRead:
    character = await db.get(Character, character_id)
    if character is None or character.owner_user_id is not None or character.status == LibraryItemStatus.DELETED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="系统形象不存在")
    art_style = await db.get(ArtStyle, character.art_style_id) if character.art_style_id else None
    latest_task = await _latest_character_image_task(db, character.id)
    return CharacterRead(
        **_character_summary(character, latest_task).model_dump(),
        reference_character_id=character.reference_character_id,
        generation_prompt=character.generation_prompt,
        art_style=ArtStyleRead.model_validate(art_style) if art_style else None,
    )


async def _prepare_system_character_values(
    db: AsyncSession,
    payload: SystemCharacterCreate | SystemCharacterUpdate,
    *,
    exclude_unset: bool = False,
) -> dict:
    values = payload.model_dump(exclude_unset=exclude_unset)
    art_style_id = values.get("art_style_id")
    if art_style_id is not None:
        style = await db.get(ArtStyle, art_style_id)
        if style is None or style.owner_user_id is not None or style.status != ArtStyleStatus.ACTIVE:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="绑定画风不可用")
    category_code = values.get("category_code")
    if category_code:
        await validate_taxonomy_codes(db, TaxonomyType.CHARACTER_CATEGORY, [category_code])
    return values


async def create_system_character(db: AsyncSession, payload: SystemCharacterCreate) -> CharacterRead:
    values = await _prepare_system_character_values(db, payload)
    character = Character(
        owner_user_id=None,
        source_type=AssetSourceType.SYSTEM,
        **values,
    )
    db.add(character)
    await db.commit()
    await db.refresh(character)
    return await get_admin_system_character(db, character.id)


async def update_system_character(db: AsyncSession, character_id: int, payload: SystemCharacterUpdate) -> CharacterRead:
    character = await db.get(Character, character_id)
    if character is None or character.owner_user_id is not None or character.status == LibraryItemStatus.DELETED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="系统形象不存在")
    values = await _prepare_system_character_values(db, payload, exclude_unset=True)
    for field, value in values.items():
        setattr(character, field, value)
    await db.commit()
    await db.refresh(character)
    return await get_admin_system_character(db, character.id)


async def delete_system_character(db: AsyncSession, character_id: int) -> None:
    character = await db.get(Character, character_id)
    if character is None or character.owner_user_id is not None or character.status == LibraryItemStatus.DELETED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="系统形象不存在")
    character.status = LibraryItemStatus.DELETED
    character.is_default = False
    await db.commit()


async def create_character(db: AsyncSession, user_id: int, payload: CharacterCreateRequest) -> CharacterRead:
    await entitlement_service.assert_can_create(db, user_id, EntitlementResourceType.CHARACTER)
    reference_image_url = None
    if payload.reference_character_id is not None:
        reference = await _get_character_model(db, payload.reference_character_id, user_id=user_id)
        if reference.owner_user_id is None and reference.access_level == AssetAccessLevel.VIP:
            await entitlement_service.assert_can_use_vip_resource(
                db,
                user_id,
                EntitlementResourceType.CHARACTER,
                str(reference.id),
            )
        if not reference.image_url:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="参考角色图片不可用")
    if payload.reference_asset_id is not None:
        reference_asset = await db.get(Asset, payload.reference_asset_id)
        if (
            reference_asset is None
            or reference_asset.owner_user_id != user_id
            or reference_asset.asset_kind != AssetKind.IMAGE
            or reference_asset.status != AssetStatus.READY
        ):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="上传角色图片不可用")
        await assert_upload_consent(
            db,
            user_id=user_id,
            consent_id=payload.upload_consent_id,
            target_type=UploadConsentTargetType.CHARACTER_REFERENCE_IMAGE,
            target_id=payload.reference_asset_id,
        )
        reference_image_url = storage_service.get_file_url(reference_asset.storage_key)
    style = await db.get(ArtStyle, payload.art_style_id) if payload.art_style_id else None
    if payload.art_style_id is not None and (style is None or style.status != ArtStyleStatus.ACTIVE):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="画风不可用")
    if style is not None and style.owner_user_id is not None and style.owner_user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权使用该画风")
    if style is not None and style.access_level == AssetAccessLevel.VIP:
        await entitlement_service.assert_can_use_vip_resource(db, user_id, EntitlementResourceType.CHARACTER, str(style.id))
    generation_prompt = payload.generation_prompt.strip() if payload.generation_prompt else None
    if payload.reference_asset_id is None and not generation_prompt:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="AI 生成角色必须填写系统提示词")
    if payload.category_code:
        await validate_taxonomy_codes(db, TaxonomyType.CHARACTER_CATEGORY, [payload.category_code])

    character = Character(
        owner_user_id=user_id,
        name=payload.name,
        description=payload.description,
        image_url=reference_image_url,
        reference_character_id=payload.reference_character_id,
        art_style_id=payload.art_style_id,
        generation_prompt=generation_prompt,
        category_code=payload.category_code,
        source_type=AssetSourceType.USER_UPLOAD if payload.reference_asset_id is not None else AssetSourceType.AI_GENERATED,
    )
    db.add(character)
    await db.flush()
    if payload.reference_asset_id is None:
        await generation_task.create_task(
            db,
            GenerationTaskCreate(
                task_type=GenerationTaskType.CHARACTER_IMAGE,
                owner_type="character",
                owner_id=character.id,
                user_id=user_id,
                input_payload={
                    "reference_character_id": payload.reference_character_id,
                    "art_style_id": payload.art_style_id,
                    "generation_prompt": generation_prompt,
                },
            ),
        )
    await set_visibility_policy(db, user_id=user_id, target_type="character", target_id=character.id)
    await db.commit()
    await db.refresh(character)
    return await get_character(db, character.id, user_id=user_id)


async def update_character(db: AsyncSession, user_id: int, character_id: int, payload: CharacterUpdateRequest) -> CharacterRead:
    character = await _get_owned_character(db, user_id, character_id)
    values = payload.model_dump(exclude_unset=True)
    art_style_id = values.get("art_style_id")
    if art_style_id is not None:
        style = await db.get(ArtStyle, art_style_id)
        if style is None or style.status != ArtStyleStatus.ACTIVE:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="画风不可用")
        if style.owner_user_id is not None and style.owner_user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权使用该画风")
        if style.access_level == AssetAccessLevel.VIP:
            await entitlement_service.assert_can_use_vip_resource(db, user_id, EntitlementResourceType.CHARACTER, str(style.id))
    category_code = values.get("category_code")
    if category_code:
        await validate_taxonomy_codes(db, TaxonomyType.CHARACTER_CATEGORY, [category_code])
    for field, value in values.items():
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
    if character.owner_user_id is not None and character.owner_user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="角色形象不存在")
    return character


async def _get_owned_character(db: AsyncSession, user_id: int, character_id: int) -> Character:
    character = await db.get(Character, character_id)
    if character is None or character.status != LibraryItemStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="角色形象不存在")
    if character.owner_user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只能管理自己的角色形象")
    return character
