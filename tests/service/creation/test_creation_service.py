from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.model.book import Book, BookPublishStatus
from app.model.creation import CreationSession, CreationSessionStatus, CreationStep, CreationType
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


class TestGenerateStoryAIError:
    """Verify P0 bug: AI provider exception must mark task as FAILED."""

    @patch("app.service.ai_provider.generate_text", new_callable=AsyncMock, side_effect=RuntimeError("LLM timeout"))
    async def test_generate_story_marks_task_failed_on_ai_error(self, mock_gen, db: AsyncSession):
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
        assert result.task.status == "failed"
        assert result.task.error_code == "PROVIDER_FAILED"
        assert "LLM timeout" in result.task.error_message
        assert result.session.status == CreationSessionStatus.FAILED


class TestGenerateImagesAIError:
    @patch("app.service.ai_provider.generate_image", new_callable=AsyncMock, side_effect=RuntimeError("Image API down"))
    async def test_generate_images_marks_task_failed_on_ai_error(self, mock_gen, db: AsyncSession):
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
        assert result.task.status == "failed"
        assert result.task.error_code == "PROVIDER_FAILED"


class TestGenerateAudioAIError:
    @patch("app.service.ai_provider.generate_audio", new_callable=AsyncMock, side_effect=RuntimeError("Audio API down"))
    async def test_generate_audio_marks_task_failed_on_ai_error(self, mock_gen, db: AsyncSession):
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
        assert result.task.status == "failed"
        assert result.task.error_code == "PROVIDER_FAILED"


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
