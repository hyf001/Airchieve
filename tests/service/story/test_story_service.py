from unittest.mock import AsyncMock, patch

from sqlalchemy.ext.asyncio import AsyncSession

from app.model.generation_task import GenerationTask, GenerationTaskStatus, GenerationTaskType
from app.model.story import Story, StoryPublishStatus
from app.schema.ai_provider import GeneratedStoryContent, StoryPromptCharacter
from app.schema.story import StoryGenerateRequest
from app.service.story.story_service import generate_user_story, run_story_generation_task


async def test_generate_user_story_allows_empty_characters(db: AsyncSession):
    result = await generate_user_story(
        db,
        user_id=1,
        payload=StoryGenerateRequest(idea_prompt="一颗想学会分享的小星星", target_word_count=500),
    )

    task = await db.get(GenerationTask, result.task.id)
    assert task is not None
    assert result.task.status == GenerationTaskStatus.QUEUED
    assert result.story.characters == []
    assert task.input_payload["characters"] == []
    assert task.input_payload["target_word_count"] == 500


@patch("app.service.story.story_service.ai_provider.create_story_content", new_callable=AsyncMock)
async def test_run_story_generation_task_saves_generated_characters(mock_create, db: AsyncSession):
    story = Story(
        owner_user_id=1,
        source_type="generated_idea",
        title="AI 故事生成中",
        summary="森林里的新朋友",
        body="森林里的新朋友",
        meta={"note": "keep"},
        language="zh",
        publish_status=StoryPublishStatus.DRAFT,
    )
    db.add(story)
    await db.flush()
    task = GenerationTask(
        task_type=GenerationTaskType.STORY,
        owner_type="story",
        owner_id=story.id,
        user_id=1,
        status=GenerationTaskStatus.RUNNING,
        input_payload={
            "idea_prompt": "森林里的新朋友",
            "characters": [],
            "target_word_count": 1000,
            "language": "zh",
        },
    )
    db.add(task)
    await db.flush()
    mock_create.return_value = GeneratedStoryContent(
        title="森林里的新朋友",
        summary="小鹿和小鸟一起帮助迷路的孩子。",
        body="小鹿在森林边遇见了小鸟。他们一起帮助迷路的孩子找到回家的路。",
        characters=[
            StoryPromptCharacter(name="小鹿", is_protagonist=True),
            StoryPromptCharacter(name="小鸟", is_protagonist=False),
        ],
    )

    await run_story_generation_task(db, task)

    await db.refresh(story)
    await db.refresh(task)
    assert story.publish_status == StoryPublishStatus.PUBLISHED
    assert story.meta["note"] == "keep"
    assert story.characters == [
        {"name": "小鹿", "is_protagonist": True},
        {"name": "小鸟", "is_protagonist": False},
    ]
    assert task.status == GenerationTaskStatus.SUCCEEDED
    mock_create.assert_awaited_once()
    assert mock_create.await_args.kwargs["target_word_count"] == 1000
