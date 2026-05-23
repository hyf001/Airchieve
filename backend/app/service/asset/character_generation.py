from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.model.asset import ArtStyle, AssetKind, AssetVisibility, Character, LibraryItemStatus
from app.model.generation_task import GenerationTask
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
    if character.reference_asset_id is not None:
        reference_image_url = await storage_service.get_asset_url(db, character.reference_asset_id, user_id=task.user_id)

    prompt = await _build_character_prompt(db, character)
    image_result = await ai_provider.generate_character_image(
        db,
        task_id=task.id,
        prompt=prompt,
        reference_image_url=reference_image_url,
    )

    image_asset_id = character.image_asset_id
    image_url = image_result
    if image_result.startswith("data:"):
        stored = await storage_service.save_generated_data_url(
            db,
            character.owner_user_id,
            data_url=image_result,
            asset_kind=AssetKind.IMAGE,
            filename_extension=".png",
            visibility=AssetVisibility.PRIVATE,
        )
        image_asset_id = stored.id
        image_url = stored.url

    character.image_asset_id = image_asset_id
    character.image_url = image_url
    await generation_task_service.mark_task_succeeded(
        db,
        task.id,
        result_refs={
            "character_id": character.id,
            "image_asset_id": image_asset_id,
            "image_url": image_url,
        },
    )


async def _build_character_prompt(db: AsyncSession, character: Character) -> str:
    style_prompt = character.custom_art_style_prompt
    if character.art_style_id is not None:
        style = await db.get(ArtStyle, character.art_style_id)
        if style is not None:
            style_prompt = style.prompt or style.description or style.name
    parts = [
        f"角色名称：{character.name}",
        f"身份标签：{character.identity_tag}" if character.identity_tag else None,
        f"角色描述：{character.description}" if character.description else None,
        f"生成要求：{character.generation_prompt}" if character.generation_prompt else None,
        f"画风要求：{style_prompt}" if style_prompt else None,
        f"分类：{character.category_code}" if character.category_code else None,
        f"适龄段：{', '.join(character.age_range_codes or [])}" if character.age_range_codes else None,
    ]
    return "\n".join(part for part in parts if part)
