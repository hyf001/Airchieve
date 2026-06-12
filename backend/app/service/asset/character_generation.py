from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.model.asset import ArtStyle, Asset, AssetKind, AssetStatus, AssetVisibility, Character, LibraryItemStatus
from app.model.generation_task import GenerationTask
from app.schema.ai_provider import CharacterPortraitInput
from app.service import ai_provider
from app.service import generation_task as generation_task_service
from app.service import storage as storage_service


async def run_character_image_task(db: AsyncSession, task: GenerationTask) -> None:
    if task.owner_type != "character":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CHARACTER_IMAGE_OWNER_INVALID")
    character = await db.get(Character, task.owner_id)
    if character is None or character.status != LibraryItemStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="CHARACTER_NOT_FOUND")
    if task.user_id is not None and character.owner_user_id != task.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CHARACTER_OWNER_MISMATCH")

    reference_image_url = None
    reference_asset_id = task.input_payload.get("reference_asset_id") if isinstance(task.input_payload, dict) else None
    if reference_asset_id is not None:
        reference_asset = await db.get(Asset, reference_asset_id)
        if (
            reference_asset is not None
            and reference_asset.owner_user_id == character.owner_user_id
            and reference_asset.asset_kind == AssetKind.IMAGE
            and reference_asset.status == AssetStatus.READY
        ):
            reference_image_url = storage_service.get_file_url(reference_asset.storage_key)
    if character.reference_character_id is not None:
        reference = await db.get(Character, character.reference_character_id)
        if reference is not None:
            reference_image_url = reference.image_url

    portrait_input = await _build_character_portrait_input(db, character, reference_image_url=reference_image_url)
    image_result = await ai_provider.create_character_portrait(
        db,
        task_id=task.id,
        character=portrait_input,
    )

    image_url = image_result
    if image_result.startswith("data:"):
        stored = await storage_service.save_generated_data_url(
            db,
            character.owner_user_id,
            data_url=image_result,
            asset_kind=AssetKind.IMAGE,
            filename_extension=".png",
            visibility=AssetVisibility.PRIVATE,
            path_scope="character/generated",
        )
        image_url = stored.url

    character.image_url = image_url
    await generation_task_service.mark_task_succeeded(
        db,
        task.id,
        result_refs={
            "character_id": character.id,
            "image_url": image_url,
        },
    )


async def _build_character_portrait_input(
    db: AsyncSession,
    character: Character,
    *,
    reference_image_url: str | None,
) -> CharacterPortraitInput:
    style_prompt = None
    if character.art_style_id is not None:
        style = await db.get(ArtStyle, character.art_style_id)
        if style is not None:
            style_prompt = style.prompt or style.description or style.name
    return CharacterPortraitInput(
        name=character.name,
        description=character.description,
        generation_prompt=character.generation_prompt,
        art_style_prompt=style_prompt,
        category_code=character.category_code,
        reference_image_url=reference_image_url,
        reference_image_policy="preserve_identity_transfer_style" if style_prompt else "preserve_identity_and_style",
    )
