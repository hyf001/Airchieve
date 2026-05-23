from unittest.mock import AsyncMock, patch

from sqlalchemy.ext.asyncio import AsyncSession

from app.model.asset import AssetAccessLevel, AssetModerationStatus, AssetSourceType, Character, LibraryItemStatus
from app.model.generation_task import GenerationTask, GenerationTaskStatus, GenerationTaskType
from app.service.asset.character_generation import run_character_image_task


async def test_run_character_image_task_persists_generated_image(db: AsyncSession):
    character = Character(
        owner_user_id=1,
        name="小勇",
        identity_tag="brave_child",
        description="A brave child explorer",
        generation_prompt="red jacket, warm smile",
        age_range_codes=["age_5_6"],
        access_level=AssetAccessLevel.FREE,
        source_type=AssetSourceType.AI_GENERATED,
        moderation_status=AssetModerationStatus.APPROVED,
        status=LibraryItemStatus.ACTIVE,
    )
    db.add(character)
    await db.flush()
    task = GenerationTask(
        task_type=GenerationTaskType.CHARACTER_IMAGE,
        owner_type="character",
        owner_id=character.id,
        user_id=1,
        status=GenerationTaskStatus.RUNNING,
        input_payload={},
    )
    db.add(task)
    await db.flush()

    with (
        patch("app.service.ai_provider.generate_character_image", new_callable=AsyncMock) as generate_image,
        patch("app.service.storage.save_generated_data_url", new_callable=AsyncMock) as save_generated,
    ):
        generate_image.return_value = "data:image/png;base64,abc"
        save_generated.return_value.id = 99
        save_generated.return_value.url = "https://cdn.example.com/character.png"

        await run_character_image_task(db, task)

    assert character.image_asset_id == 99
    assert character.image_url == "https://cdn.example.com/character.png"
    assert task.status == GenerationTaskStatus.SUCCEEDED
    assert task.output_payload == {
        "character_id": character.id,
        "image_asset_id": 99,
        "image_url": "https://cdn.example.com/character.png",
    }
