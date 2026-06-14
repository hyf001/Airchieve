from unittest.mock import AsyncMock, patch

import pytest

from app.schema.ai_provider import AudioGenerationRequest, VoicePromptRef
from app.service.ai_provider.errors import AiProviderError
from app.service.ai_provider import service as ai_provider_service
from app.service.ai_provider.providers import kling


class TestKlingGenerateAudio:
    @patch("app.service.ai_provider.service.kling_generate_audio", new_callable=AsyncMock)
    async def test_service_provider_uses_voice_ref(self, mock_generate):
        mock_generate.return_value = "https://example.com/audio.mp3"

        result = await ai_provider_service._generate_audio_with_provider(
            "kling",
            "kling-tts",
            "你好",
            voice_ref={"provider_voice_id": "zh_female1"},
        )

        assert result == "https://example.com/audio.mp3"
        request = mock_generate.await_args.args[0]
        assert request.text == "你好"
        assert request.voice_ref.provider_voice_id == "zh_female1"

    async def test_service_provider_requires_selected_voice(self):
        with pytest.raises(AiProviderError) as exc_info:
            await ai_provider_service._generate_audio_with_provider(
                "kling",
                "kling-tts",
                "你好",
                voice_ref=None,
            )

        assert exc_info.value.error_code == "KLING_TTS_VOICE_MISSING"

    async def test_submits_official_tts_payload(self):
        captured_body = {}

        def submit_task(body):
            captured_body.update(body)
            return {
                "task_id": "task-1",
                "task_status": "succeed",
                "task_result": {"audios": [{"url": "https://example.com/output.mp3"}]},
            }

        with patch("app.service.ai_provider.providers.kling._submit_tts_task", side_effect=submit_task):
            result = await kling.kling_generate_audio(
                AudioGenerationRequest(
                    text="hello",
                    voice_ref=VoicePromptRef(provider_voice_id="Friendly#oversea_male1#en"),
                )
            )

        assert result == "https://example.com/output.mp3"
        assert captured_body == {
            "text": "hello",
            "voice_id": "oversea_male1",
            "voice_language": "en",
            "voice_speed": 1.0,
        }

    async def test_submits_two_part_voice_config(self):
        captured_body = {}

        def submit_task(body):
            captured_body.update(body)
            return {
                "task_id": "task-1",
                "task_status": "succeed",
                "task_result": {"audios": [{"url": "https://example.com/output.mp3"}]},
            }

        with patch("app.service.ai_provider.providers.kling._submit_tts_task", side_effect=submit_task):
            await kling.kling_generate_audio(
                AudioGenerationRequest(
                    text="hello",
                    voice_ref=VoicePromptRef(provider_voice_id="oversea_male1#en"),
                )
            )

        assert captured_body["voice_id"] == "oversea_male1"
        assert captured_body["voice_language"] == "en"

    async def test_submits_voice_language_field(self):
        captured_body = {}

        def submit_task(body):
            captured_body.update(body)
            return {
                "task_id": "task-1",
                "task_status": "succeed",
                "task_result": {"audios": [{"url": "https://example.com/output.mp3"}]},
            }

        with patch("app.service.ai_provider.providers.kling._submit_tts_task", side_effect=submit_task):
            await kling.kling_generate_audio(
                AudioGenerationRequest(
                    text="hello",
                    voice_ref=VoicePromptRef(provider_voice_id="oversea_male1", voice_language="en"),
                )
            )

        assert captured_body["voice_id"] == "oversea_male1"
        assert captured_body["voice_language"] == "en"

    async def test_requires_text_limit(self):
        with pytest.raises(AiProviderError) as exc_info:
            await kling.kling_generate_audio(
                AudioGenerationRequest(text="x" * 1001, voice_ref=VoicePromptRef(provider_voice_id="zh_female1"))
            )

        assert exc_info.value.error_code == "KLING_TTS_TEXT_TOO_LONG"

    async def test_rejects_unsupported_language(self):
        with pytest.raises(AiProviderError) as exc_info:
            await kling.kling_generate_audio(
                AudioGenerationRequest(text="hello", voice_ref=VoicePromptRef(provider_voice_id="voice")),
                voice_language="ja",
            )

        assert exc_info.value.error_code == "KLING_TTS_LANGUAGE_UNSUPPORTED"
