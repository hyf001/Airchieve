from unittest.mock import AsyncMock, patch

from sqlalchemy.ext.asyncio import AsyncSession

from app.schema.ai_provider import PageMediaInput, StoryboardPlaybackSegment, StoryboardPlaybackSegmentType, VoicePromptRef
from app.service.ai_provider import service as ai_provider_service


class TestAudioRoleVoiceRefs:
    @patch("app.service.ai_provider.service._generate_audio_with_provider", new_callable=AsyncMock)
    async def test_segment_audio_uses_role_voice_refs(self, mock_generate, db: AsyncSession):
        mock_generate.side_effect = [
            "data:audio/wav;base64,narration",
            "data:audio/wav;base64,cat",
            "data:audio/wav;base64,dog",
        ]

        await ai_provider_service.create_picture_book_page_audio(
            db,
            task_id=None,
            pages=[
                PageMediaInput(
                    id=10,
                    page_no=1,
                    playback_segments=[
                        StoryboardPlaybackSegment(segment_type=StoryboardPlaybackSegmentType.NARRATION, text="旁白", sort_order=1),
                        StoryboardPlaybackSegment(segment_type=StoryboardPlaybackSegmentType.DIALOGUE, speaker_ref="cat", text="喵", sort_order=2),
                        StoryboardPlaybackSegment(segment_type=StoryboardPlaybackSegmentType.DIALOGUE, speaker_ref="dog", text="汪", sort_order=3),
                    ],
                    voice_config=VoicePromptRef(
                        role_code="narration",
                        provider_voice_id="voice_narration",
                        role_voice_refs=[
                            VoicePromptRef(role_code="cat", provider_voice_id="voice_cat"),
                            VoicePromptRef(role_code="dog", provider_voice_id="voice_dog"),
                        ],
                    ),
                )
            ],
        )

        used_voice_ids = [call.kwargs["voice_ref"].provider_voice_id for call in mock_generate.await_args_list]
        assert used_voice_ids == ["voice_narration", "voice_cat", "voice_dog"]
