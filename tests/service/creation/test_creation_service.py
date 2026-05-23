from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.model.book import Book, BookPublishStatus
from app.model.creation import CreationSession, CreationSessionStatus, CreationStep, CreationStoryboardPage, CreationType
from app.model.generation_task import GenerationTask, GenerationTaskStatus
from app.schema.creation import CreationSessionCreate


async def _create_test_session(db: AsyncSession, user_id: int = 1, **overrides) -> CreationSession:
    defaults = {
        "user_id": user_id,
        "creation_type": CreationType.STORY_TO_BOOK,
        "current_step": CreationStep.STORY,
        "story_source_type": "idea",
        "language": "zh",
        "target_page_count": 8,
        "status": CreationSessionStatus.DRAFT,
        "age_range_codes": ["age_5_6"],
        "theme_codes": ["adventure"],
        "education_goal_codes": ["courage"],
    }
    defaults.update(overrides)
    session = CreationSession(**defaults)
    db.add(session)
    await db.flush()
    return session


class TestGenerateStoryTask:
    """Verify story generation is queued for the worker."""

    @patch("app.service.ai_provider.generate_text", new_callable=AsyncMock)
    async def test_generate_story_returns_queued_task(self, mock_gen, db: AsyncSession):
        session = await _create_test_session(db)
        await db.commit()

        from app.schema.creation import IdeaStoryGenerateRequest
        from app.service.creation import generate_story

        result = await generate_story(
            db,
            user_id=1,
            session_id=session.id,
            payload=IdeaStoryGenerateRequest(idea_prompt="a brave little cat"),
        )
        assert result.task.status == GenerationTaskStatus.QUEUED
        mock_gen.assert_not_called()


class TestGenerateImagesAIError:
    @patch("app.service.ai_provider.generate_image", new_callable=AsyncMock)
    async def test_generate_images_returns_queued_task(self, mock_gen, db: AsyncSession):
        session = await _create_test_session(db)
        await db.commit()

        from app.schema.creation import GeneratePagesRequest
        from app.service.creation import generate_images

        result = await generate_images(
            db,
            user_id=1,
            session_id=session.id,
            payload=GeneratePagesRequest(page_ids=None),
        )
        assert result.task.status == GenerationTaskStatus.QUEUED
        mock_gen.assert_not_called()


class TestGenerateAudioAIError:
    @patch("app.service.ai_provider.generate_audio", new_callable=AsyncMock)
    async def test_generate_audio_returns_queued_task(self, mock_gen, db: AsyncSession):
        session = await _create_test_session(db)
        await db.commit()

        from app.schema.creation import GeneratePagesRequest
        from app.service.creation import generate_audio

        result = await generate_audio(
            db,
            user_id=1,
            session_id=session.id,
            payload=GeneratePagesRequest(page_ids=None),
        )
        assert result.task.status == GenerationTaskStatus.QUEUED
        mock_gen.assert_not_called()


class TestGenerateLipSync:
    @patch("app.service.ai_provider.generate_lip_sync", new_callable=AsyncMock)
    async def test_generate_lip_sync_applies_page_result(self, mock_gen, db: AsyncSession):
        session = await _create_test_session(db)
        page = CreationStoryboardPage(
            session_id=session.id,
            page_no=1,
            title="Page 1",
            text_zh="你好",
            narration_text="你好",
            visual_prompt="孩子在说话",
            image_url="https://example.com/page.png",
            audio_url="https://example.com/audio.wav",
        )
        db.add(page)
        await db.commit()
        mock_gen.return_value = {"page_results": [{"page_id": page.id, "lip_sync_url": "https://example.com/lip.mp4"}]}

        from app.schema.creation import GeneratePagesRequest
        from app.service.creation import generate_lip_sync, run_creation_lip_sync_task

        result = await generate_lip_sync(
            db,
            user_id=1,
            session_id=session.id,
            payload=GeneratePagesRequest(page_ids=[page.id]),
        )

        assert result.task.status == GenerationTaskStatus.QUEUED
        task = await db.get(GenerationTask, result.task.id)
        assert task is not None
        await run_creation_lip_sync_task(db, task)
        await db.commit()
        refreshed_task = await db.get(GenerationTask, task.id)
        refreshed_page = await db.get(CreationStoryboardPage, page.id)
        assert refreshed_task.status == GenerationTaskStatus.SUCCEEDED
        assert refreshed_page.lip_sync_url == "https://example.com/lip.mp4"


class TestRegenerateUnsupported:
    """Verify that unsupported regenerate target types return 501."""

    async def test_regenerate_story_returns_501(self, db: AsyncSession):
        session = await _create_test_session(db)
        await db.commit()

        from app.schema.creation import RegenerateRequest, RegenerateTargetType
        from app.service.creation import regenerate

        with pytest.raises(HTTPException) as exc_info:
            await regenerate(
                db,
                user_id=1,
                session_id=session.id,
                payload=RegenerateRequest(target_type=RegenerateTargetType.STORY),
            )
        assert exc_info.value.status_code == 501


class TestSaveBookStateGuard:
    """Verify save_book rejects sessions not in PREVIEW state."""

    async def test_save_draft_session_raises(self, db: AsyncSession):
        session = await _create_test_session(db, status=CreationSessionStatus.DRAFT)
        await db.commit()

        from app.service.creation import save_book

        with pytest.raises(HTTPException) as exc_info:
            await save_book(db, user_id=1, session_id=session.id)
        assert exc_info.value.status_code == 400
        assert "预览" in exc_info.value.detail
