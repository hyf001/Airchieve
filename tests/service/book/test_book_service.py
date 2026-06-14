from sqlalchemy.ext.asyncio import AsyncSession

from app.model.asset import AssetAccessLevel, AssetSourceType, BackgroundMusic, LibraryItemStatus, Voice
from app.model.book import (
    Book,
    BookLipSyncStatus,
    BookModerationStatus,
    BookPage,
    BookPlaybackMediaMode,
    BookPlaybackSegment,
    BookPlaybackSegmentType,
    BookPublishStatus,
    BookSegmentFallbackMode,
    BookSoundEffectCue,
    BookSoundEffectTriggerType,
    BookSubtitleCue,
    BookSubtitleCueType,
    BookSubtitlePosition,
)
from app.schema.book import BookPlayerOptions
from app.service.book.book_service import get_player_payload


async def _create_published_book(db: AsyncSession, **overrides) -> Book:
    defaults = {
        "owner_user_id": 1,
        "source_type": "generated",
        "title": "星星绘本",
        "summary": "一场星空冒险",
        "language": "zh",
        "page_count": 1,
        "publish_status": BookPublishStatus.PUBLISHED,
        "moderation_status": BookModerationStatus.APPROVED,
    }
    defaults.update(overrides)
    book = Book(**defaults)
    db.add(book)
    await db.flush()
    return book


class TestGetPlayerPayload:
    async def test_reads_playback_segments_subtitles_sound_effects_and_voice(self, db: AsyncSession):
        voice = Voice(
            owner_user_id=None,
            name="温柔旁白",
            voice_style_code="gentle",
            access_level=AssetAccessLevel.FREE,
            source_type=AssetSourceType.SYSTEM,
            status=LibraryItemStatus.ACTIVE,
        )
        music = BackgroundMusic(
            owner_user_id=None,
            name="星光音乐",
            audio_url="https://example.com/bgm.mp3",
            access_level=AssetAccessLevel.FREE,
            source_type=AssetSourceType.SYSTEM,
            status=LibraryItemStatus.ACTIVE,
        )
        db.add(music)
        await db.flush()
        db.add(voice)
        await db.flush()
        book = await _create_published_book(
            db,
            default_voice_id=voice.id,
            background_music_id=music.id,
        )
        page = BookPage(
            book_id=book.id,
            page_no=1,
            title="启程",
            text_zh="我们出发",
            image_url="https://example.com/page.png",
            audio_url="https://example.com/page.wav",
        )
        db.add(page)
        await db.flush()
        segment = BookPlaybackSegment(
            page_id=page.id,
            segment_type=BookPlaybackSegmentType.NARRATION,
            image_url="https://example.com/segment.png",
            audio_url="https://example.com/segment.wav",
            lip_sync_url="https://example.com/segment.mp4",
            media_mode=BookPlaybackMediaMode.LIP_SYNC,
            start_ms=0,
            end_ms=2400,
            fallback_mode=BookSegmentFallbackMode.PAGE_IMAGE_AUDIO,
            lip_sync_status=BookLipSyncStatus.READY,
            sort_order=0,
        )
        db.add(segment)
        await db.flush()
        db.add(
            BookSubtitleCue(
                segment_id=segment.id,
                cue_type=BookSubtitleCueType.NARRATION,
                start_ms=0,
                end_ms=2400,
                text_zh="我们出发",
                text_en="Let's go",
                position=BookSubtitlePosition.TOP,
                position_config={"x": 8},
                sort_order=0,
            )
        )
        db.add(
            BookSoundEffectCue(
                page_id=page.id,
                segment_id=segment.id,
                trigger_type=BookSoundEffectTriggerType.SEGMENT,
                sound_effect_url="https://example.com/chime.wav",
                start_ms=100,
                volume=80,
                loop=False,
                sort_order=0,
            )
        )
        await db.commit()

        payload = await get_player_payload(
            db,
            book_id=book.id,
            user_id=1,
            options=BookPlayerOptions(text_mode="bilingual"),
        )

        assert payload.book.background_music_id == music.id
        assert payload.book.background_music_url == "https://example.com/bgm.mp3"
        assert payload.default_voice is not None
        assert payload.default_voice.id == voice.id
        assert payload.default_voice.name == "温柔旁白"
        assert payload.default_text_mode == "bilingual"
        assert len(payload.pages) == 1
        page_read = payload.pages[0]
        assert len(page_read.playback_segments) == 1
        segment_read = page_read.playback_segments[0]
        assert segment_read.media_mode == BookPlaybackMediaMode.LIP_SYNC
        assert segment_read.lip_sync_status == BookLipSyncStatus.READY
        assert segment_read.subtitle_cues[0].position == BookSubtitlePosition.TOP
        assert segment_read.subtitle_cues[0].position_config == {"x": 8}
        assert segment_read.sound_effects[0].sound_effect_url == "https://example.com/chime.wav"

    async def test_builds_fallback_narration_segment_for_legacy_page(self, db: AsyncSession):
        book = await _create_published_book(db)
        page = BookPage(
            book_id=book.id,
            page_no=1,
            title="旧页",
            text_zh="旧旁白",
            text_en="Legacy text",
            image_url="https://example.com/legacy.png",
            audio_url="https://example.com/legacy.wav",
            duration_seconds=7,
        )
        db.add(page)
        await db.commit()

        payload = await get_player_payload(db, book_id=book.id, user_id=1)

        segment = payload.pages[0].playback_segments[0]
        assert segment.id == -page.id
        assert segment.segment_type == BookPlaybackSegmentType.NARRATION
        assert segment.media_mode == BookPlaybackMediaMode.AUDIO
        assert segment.fallback_mode == BookSegmentFallbackMode.PAGE_IMAGE_AUDIO
        assert segment.end_ms == 7000
        assert segment.subtitle_cues[0].text_zh == "旧旁白"
        assert segment.subtitle_cues[0].text_en == "Legacy text"
