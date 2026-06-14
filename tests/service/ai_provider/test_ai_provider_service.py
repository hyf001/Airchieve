from unittest.mock import AsyncMock, patch

from sqlalchemy.ext.asyncio import AsyncSession

import pytest

from app.model.ai_provider import AiProviderCall, AiProviderCallStatus, AiProviderCapability
from app.service.ai_provider.errors import AiProviderError
from app.service.ai_provider import (
    generate_audio,
    generate_image,
    generate_story,
    generate_structured,
    generate_text,
)
from app.service.ai_provider import service as ai_provider_service


class TestGenerateText:
    @patch("app.service.ai_provider.service._generate_text_with_provider", new_callable=AsyncMock)
    async def test_returns_string(self, mock_generate, db: AsyncSession):
        mock_generate.return_value = "小猫学会了勇敢。"

        result = await generate_text(db, task_id=None, prompt="一只勇敢的小猫")

        assert isinstance(result, str)
        assert len(result) > 0
        assert result == "小猫学会了勇敢。"

    @patch("app.service.ai_provider.service._generate_text_with_provider", new_callable=AsyncMock)
    async def test_records_provider_call(self, mock_generate, db: AsyncSession):
        mock_generate.return_value = "hello story"

        await generate_text(db, task_id=42, prompt="hello")
        from sqlalchemy import select

        calls = (await db.execute(select(AiProviderCall))).scalars().all()
        assert len(calls) >= 1
        call = calls[-1]
        assert call.task_id == 42
        assert call.capability == AiProviderCapability.TEXT
        assert call.status == AiProviderCallStatus.SUCCEEDED
        assert call.latency_ms is not None


class TestGenerateStory:
    @patch("app.service.ai_provider.service._generate_text_with_provider", new_callable=AsyncMock)
    async def test_returns_story_fields(self, mock_generate, db: AsyncSession):
        mock_generate.return_value = '{"title":"月亮小船","summary":"一次温暖的夜晚冒险","content":"小星星坐上月亮小船，学会了勇敢。"}'

        result = await generate_story(
            db,
            task_id=7,
            idea_prompt="一个孩子寻找月亮",
            language="zh",
            age_range_codes=["age_5_6"],
            theme_codes=["adventure"],
            narrative_style_code="bedtime",
        )

        assert result == {
            "title": "月亮小船",
            "summary": "一次温暖的夜晚冒险",
            "body": "小星星坐上月亮小船，学会了勇敢。",
        }
        mock_generate.assert_awaited_once()
        assert "用户灵感" in mock_generate.await_args.args[2]
        assert "age_5_6" in mock_generate.await_args.args[2]
        assert "adventure" in mock_generate.await_args.args[2]
        assert mock_generate.await_args.kwargs["response_json"] is True


class TestGenerateStructured:
    @staticmethod
    def _storyboard_response(page_count: int) -> str:
        pages = [
            {
                "page_no": index,
                "title": f"第 {index} 页",
                "text_zh": f"第 {index} 页文本",
                "visual_prompt": f"第 {index} 页画面",
            }
            for index in range(1, page_count + 1)
        ]
        import json

        return json.dumps({"pages": pages})

    @patch("app.service.ai_provider.service._generate_text_with_provider", new_callable=AsyncMock)
    async def test_returns_pages(self, mock_generate, db: AsyncSession):
        mock_generate.return_value = self._storyboard_response(6)

        result = await generate_structured(
            db,
            task_id=None,
            request={"target_page_count": 6, "title": "测试绘本"},
        )
        assert "pages" in result
        assert len(result["pages"]) == 6
        for page in result["pages"]:
            assert "page_no" in page
            assert "text_zh" in page
            assert "visual_prompt" in page
        assert mock_generate.await_args.kwargs["response_json"] is True

    @patch("app.service.ai_provider.service._generate_text_with_provider", new_callable=AsyncMock)
    async def test_default_page_count(self, mock_generate, db: AsyncSession):
        mock_generate.return_value = self._storyboard_response(8)

        result = await generate_structured(db, task_id=None, request={})

        assert len(result["pages"]) == 8


class TestGenerateImage:
    @patch("app.service.ai_provider.service._generate_image_with_provider", new_callable=AsyncMock)
    async def test_returns_dict(self, mock_generate, db: AsyncSession):
        mock_generate.return_value = "data:image/png;base64,abc"
        result = await generate_image(
            db,
            task_id=1,
            pages=[
                {"id": 10, "page_no": 1, "title": "Page 1", "visual_prompt": "森林"},
                {"id": 20, "page_no": 2, "title": "Page 2", "visual_prompt": "河边"},
            ],
        )
        assert result["page_results"] == [
            {"page_id": 10, "image_url": "data:image/png;base64,abc"},
            {"page_id": 20, "image_url": "data:image/png;base64,abc"},
        ]


class TestGenerateAudio:
    @patch("app.service.ai_provider.service._generate_audio_with_provider", new_callable=AsyncMock)
    async def test_returns_dict(self, mock_generate, db: AsyncSession):
        mock_generate.return_value = "data:audio/wav;base64,abc"
        result = await generate_audio(
            db,
            task_id=1,
            pages=[{"id": 10, "page_no": 1, "text_zh": "你好"}],
        )
        assert result["page_results"] == [{"page_id": 10, "audio_url": "data:audio/wav;base64,abc"}]

    @patch("app.service.ai_provider.service.aliyun_generate_audio", new_callable=AsyncMock)
    async def test_aliyun_provider_uses_voice_ref(self, mock_generate):
        mock_generate.return_value = "data:audio/wav;base64,abc"

        result = await ai_provider_service._generate_audio_with_provider(
            "aliyun",
            "aliyun-nls-tts",
            "你好",
            voice_ref={"provider_voice_id": "xiaoxiao"},
        )

        assert result == "data:audio/wav;base64,abc"
        mock_generate.assert_awaited_once_with("你好", voice="xiaoxiao", emotion_type=None)

    @patch("app.service.ai_provider.service.aliyun_generate_audio", new_callable=AsyncMock)
    async def test_aliyun_provider_uses_emotion_ref(self, mock_generate):
        mock_generate.return_value = "data:audio/wav;base64,abc"

        await ai_provider_service._generate_audio_with_provider(
            "aliyun",
            "aliyun-nls-tts",
            "你好",
            voice_ref={"provider_voice_id": "zhimiao_emo", "emotion_type": "happy"},
        )

        mock_generate.assert_awaited_once_with("你好", voice="zhimiao_emo", emotion_type="happy")

    async def test_aliyun_provider_requires_selected_voice(self):
        with pytest.raises(AiProviderError) as exc_info:
            await ai_provider_service._generate_audio_with_provider(
                "aliyun",
                "aliyun-nls-tts",
                "你好",
                voice_ref=None,
            )

        assert exc_info.value.error_code == "ALIYUN_TTS_VOICE_MISSING"
