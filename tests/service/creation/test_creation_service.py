from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.model.book import (
    BookLipSyncStatus,
    BookPage,
    BookPlaybackMediaMode,
    BookPlaybackSegment,
    BookPlaybackSegmentType,
    BookSegmentFallbackMode,
    BookSubtitlePosition,
)
from app.model.asset import ArtStyle, AssetAccessLevel, AssetSourceType, LibraryItemStatus, Voice
from app.model.creation import CreationPageDraft, CreationSession, CreationSessionStatus, CreationStep, CreationType, PageDraftTaskStatus
from app.model.generation_task import GenerationTask, GenerationTaskStatus, GenerationTaskType
from app.schema.ai_provider import PageAudioResult, PageLipSyncResult, PageSegmentAudioResult, PictureBookAudioResult, PictureBookLipSyncResult


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

    @patch("app.service.ai_provider.draft_story_text_from_prompt", new_callable=AsyncMock)
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
    @patch("app.service.ai_provider.create_picture_book_page_images", new_callable=AsyncMock)
    async def test_generate_images_returns_queued_task(self, mock_gen, db: AsyncSession):
        session = await _create_test_session(db)
        await db.commit()

        from app.schema.creation import GenerateImagesRequest
        from app.service.creation import generate_images

        result = await generate_images(
            db,
            user_id=1,
            session_id=session.id,
            payload=GenerateImagesRequest(),
        )
        assert result.task.status == GenerationTaskStatus.QUEUED
        mock_gen.assert_not_called()


class TestGenerateAudioAIError:
    @patch("app.service.ai_provider.create_picture_book_page_audio", new_callable=AsyncMock)
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


class TestCreationAudioPersistence:
    @patch("app.service.creation.service.storage_service.save_generated_url", new_callable=AsyncMock)
    @patch("app.service.creation.service.ai_provider.create_picture_book_page_audio", new_callable=AsyncMock)
    async def test_run_audio_task_stores_remote_audio_urls_to_oss(self, mock_audio, mock_save, db: AsyncSession):
        session = await _create_test_session(db, status=CreationSessionStatus.GENERATING, current_step=CreationStep.VOICE)
        page = CreationPageDraft(
            session_id=session.id,
            page_no=1,
            title="第 1 页",
            text_zh="旁白文本",
            visual_prompt="孩子在星空下阅读",
            playback_segments=[{"sort_order": 1, "segment_type": "narration", "text": "旁白文本"}],
            audio_status=PageDraftTaskStatus.PENDING,
        )
        db.add(page)
        await db.flush()
        task = GenerationTask(
            task_type=GenerationTaskType.AUDIO,
            owner_type="creation",
            owner_id=session.id,
            user_id=session.user_id,
            status=GenerationTaskStatus.RUNNING,
            input_payload={"page_ids": [page.id]},
        )
        db.add(task)
        await db.flush()
        mock_audio.return_value = PictureBookAudioResult(
            page_results=[
                PageAudioResult(
                    page_id=page.id,
                    audio_url="https://kling.example.com/page-audio.mp3",
                    segment_results=[
                        PageSegmentAudioResult(sort_order=1, audio_url="https://kling.example.com/segment-audio.mp3"),
                    ],
                )
            ]
        )
        mock_save.side_effect = [
            type("StoredAsset", (), {"id": 201, "url": "https://oss.example.com/page-audio.mp3"})(),
            type("StoredAsset", (), {"id": 202, "url": "https://oss.example.com/segment-audio.mp3"})(),
        ]

        from app.service.creation.service import run_creation_audio_task

        await run_creation_audio_task(db, task)

        assert mock_save.await_count == 2
        assert [call.kwargs["url"] for call in mock_save.await_args_list] == [
            "https://kling.example.com/page-audio.mp3",
            "https://kling.example.com/segment-audio.mp3",
        ]
        await db.refresh(page)
        await db.refresh(task)
        assert page.audio_url == "https://oss.example.com/page-audio.mp3"
        assert page.audio_asset_id == 201
        assert page.playback_segments[0]["audio_url"] == "https://oss.example.com/segment-audio.mp3"
        assert page.audio_status == PageDraftTaskStatus.READY
        assert task.status == GenerationTaskStatus.SUCCEEDED


class TestUpdateSessionConfigVoiceRef:
    async def test_system_voice_style_code_is_stored_as_provider_voice_id(self, db: AsyncSession):
        session = await _create_test_session(db)
        voice = Voice(
            owner_user_id=None,
            name="阿里云小云",
            voice_style_code="xiaoyun",
            voice_language="zh",
            emotion_type="happy",
            access_level=AssetAccessLevel.FREE,
            source_type=AssetSourceType.SYSTEM,
            status=LibraryItemStatus.ACTIVE,
        )
        db.add(voice)
        await db.commit()

        from app.schema.creation import CreationConfigPatch, VoiceRef
        from app.schema.creation.creation import VoiceRefSource
        from app.service.creation import update_session_config

        result = await update_session_config(
            db,
            user_id=1,
            session_id=session.id,
            payload=CreationConfigPatch(
                voice_ref=VoiceRef(
                    source=VoiceRefSource.SYSTEM,
                    voice_id=voice.id,
                    display_name="",
                )
            ),
        )

        assert result.voice_ref is not None
        assert result.voice_ref["provider_voice_id"] == "xiaoyun"
        assert result.voice_ref["voice_language"] == "zh"
        assert result.voice_ref["emotion_type"] == "happy"
        assert result.voice_ref["display_name"] == "阿里云小云"


class TestUpdateSessionConfigArtStyleRef:
    async def test_art_style_ref_moves_session_to_character_step(self, db: AsyncSession):
        session = await _create_test_session(db, current_step=CreationStep.ART_STYLE)
        art_style = ArtStyle(
            owner_user_id=None,
            code="watercolor",
            name="水彩画风",
            description="柔和水彩",
            prompt="soft watercolor",
            access_level=AssetAccessLevel.FREE,
        )
        db.add(art_style)
        await db.commit()

        from app.schema.creation import ArtStyleRef, CreationConfigPatch
        from app.schema.creation.creation import ArtStyleSource
        from app.service.creation import update_session_config

        result = await update_session_config(
            db,
            user_id=1,
            session_id=session.id,
            payload=CreationConfigPatch(
                art_style_ref=ArtStyleRef(
                    source=ArtStyleSource.SYSTEM,
                    art_style_id=art_style.id,
                    art_style_code=art_style.code,
                )
            ),
        )

        assert result.current_step == CreationStep.CHARACTER
        assert result.art_style_ref is not None
        assert result.art_style_ref["art_style_id"] == art_style.id

    async def test_character_refs_move_story_session_to_storyboard_step(self, db: AsyncSession):
        session = await _create_test_session(db, current_step=CreationStep.CHARACTER)
        await db.commit()

        from app.schema.creation import CharacterRef, CreationConfigPatch
        from app.schema.creation.creation import CharacterRefSource
        from app.service.creation import update_session_config

        result = await update_session_config(
            db,
            user_id=1,
            session_id=session.id,
            payload=CreationConfigPatch(
                character_refs=[
                    CharacterRef(
                        source=CharacterRefSource.GENERATED,
                        character_id=None,
                        role_code="role_1",
                        display_name="小猫",
                    )
                ]
            ),
        )

        assert result.current_step == CreationStep.STORYBOARD


class TestGenerateLipSync:
    @patch("app.service.ai_provider.create_picture_book_page_lip_sync", new_callable=AsyncMock)
    async def test_generate_lip_sync_applies_page_result(self, mock_gen, db: AsyncSession):
        session = await _create_test_session(db)
        page = CreationPageDraft(
            session_id=session.id,
            page_no=1,
            title="Page 1",
            text_zh="你好",
            visual_prompt="孩子在说话",
            image_url="https://example.com/page.png",
            audio_url="https://example.com/audio.wav",
        )
        db.add(page)
        await db.commit()
        mock_gen.return_value = PictureBookLipSyncResult(
            page_results=[
                PageLipSyncResult(page_id=page.id, lip_sync_url="data:video/mp4;base64,AAAA")
            ]
        )

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
        refreshed_page = await db.get(CreationPageDraft, page.id)
        assert refreshed_task.status == GenerationTaskStatus.SUCCEEDED
        assert refreshed_page.lip_sync_url is not None
        assert refreshed_page.lip_sync_url.endswith(".mp4")


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
    """Verify save_book rejects sessions that do not have page drafts."""

    async def test_save_session_without_page_drafts_raises(self, db: AsyncSession):
        session = await _create_test_session(db, status=CreationSessionStatus.DRAFT)
        await db.commit()

        from app.service.creation import save_book

        with pytest.raises(HTTPException) as exc_info:
            await save_book(db, user_id=1, session_id=session.id)
        assert exc_info.value.status_code == 400
        assert "分镜" in exc_info.value.detail

    async def test_save_draft_session_creates_playback_segments_and_subtitles(self, db: AsyncSession):
        session = await _create_test_session(db, status=CreationSessionStatus.DRAFT)
        page = CreationPageDraft(
            session_id=session.id,
            page_no=1,
            title="第 1 页",
            text_zh="旁白文本",
            text_en="Narration text",
            visual_prompt="孩子在星空下阅读",
            image_url="https://example.com/page.png",
            audio_url="https://example.com/narration.wav",
            lip_sync_url="https://example.com/narration.mp4",
            image_status=PageDraftTaskStatus.READY,
            audio_status=PageDraftTaskStatus.READY,
            subtitle_config={"position": "top", "position_config": {"x": 12, "y": 24}},
            playback_segments=[
                {
                    "sort_order": 0,
                    "segment_type": "narration",
                    "text": "旁白文本",
                    "audio_url": "https://example.com/narration.wav",
                },
                {
                    "sort_order": 1,
                    "segment_type": "dialogue",
                    "speaker_ref": "hero",
                    "text": "我们出发吧",
                    "audio_url": "https://example.com/dialogue.wav",
                    "lip_sync_url": "https://example.com/dialogue.mp4",
                    "start_ms": 1000,
                    "end_ms": 2600,
                },
            ],
        )
        db.add(page)
        await db.commit()

        from app.service.creation import save_book

        result = await save_book(db, user_id=1, session_id=session.id)

        assert result.session.status == CreationSessionStatus.SAVED
        saved_page = (
            await db.execute(
                select(BookPage)
                .options(
                    selectinload(BookPage.playback_segments).selectinload(BookPlaybackSegment.subtitle_cues),
                )
                .where(BookPage.book_id == result.book.id)
            )
        ).scalar_one()
        assert saved_page.image_url == "https://example.com/page.png"
        assert saved_page.audio_url == "https://example.com/narration.wav"
        assert len(saved_page.playback_segments) == 2

        narration_segment = saved_page.playback_segments[0]
        assert narration_segment.segment_type == BookPlaybackSegmentType.NARRATION
        assert narration_segment.media_mode == BookPlaybackMediaMode.AUDIO
        assert narration_segment.fallback_mode == BookSegmentFallbackMode.PAGE_IMAGE_AUDIO
        assert narration_segment.lip_sync_status == BookLipSyncStatus.NONE
        assert narration_segment.subtitle_cues[0].text_zh == "旁白文本"
        assert narration_segment.subtitle_cues[0].position == BookSubtitlePosition.TOP
        assert narration_segment.subtitle_cues[0].position_config == {"x": 12, "y": 24}

        dialogue_segment = saved_page.playback_segments[1]
        assert dialogue_segment.segment_type == BookPlaybackSegmentType.DIALOGUE
        assert dialogue_segment.speaker_ref == "hero"
        assert dialogue_segment.start_ms == 1000
        assert dialogue_segment.end_ms == 2600
        assert dialogue_segment.subtitle_cues[0].text_zh == "我们出发吧"
        assert dialogue_segment.subtitle_cues[0].end_ms == 1600

    async def test_save_session_with_pending_media_raises(self, db: AsyncSession):
        session = await _create_test_session(db, status=CreationSessionStatus.PREVIEW)
        page = CreationPageDraft(
            session_id=session.id,
            page_no=1,
            title="第 1 页",
            text_zh="旁白文本",
            visual_prompt="孩子在星空下阅读",
            image_url="https://example.com/page.png",
            audio_url="https://example.com/narration.wav",
            image_status=PageDraftTaskStatus.PENDING,
            audio_status=PageDraftTaskStatus.READY,
        )
        db.add(page)
        await db.commit()

        from app.service.creation import save_book

        with pytest.raises(HTTPException) as exc_info:
            await save_book(db, user_id=1, session_id=session.id)
        assert exc_info.value.status_code == 400
        assert "插图和语音生成" in exc_info.value.detail
