from unittest.mock import AsyncMock, patch

from sqlalchemy.ext.asyncio import AsyncSession

from app.model.ai_provider import AiProviderCall, AiProviderCallStatus, AiProviderCapability
from app.service.ai_provider import (
    generate_audio,
    generate_image,
    generate_structured,
    generate_text,
)


class TestGenerateText:
    async def test_returns_string(self, db: AsyncSession):
        result = await generate_text(db, task_id=None, prompt="一只勇敢的小猫")
        assert isinstance(result, str)
        assert len(result) > 0

    async def test_records_provider_call(self, db: AsyncSession):
        await generate_text(db, task_id=42, prompt="hello")
        from sqlalchemy import select

        calls = (await db.execute(select(AiProviderCall))).scalars().all()
        assert len(calls) >= 1
        call = calls[-1]
        assert call.task_id == 42
        assert call.capability == AiProviderCapability.TEXT
        assert call.status == AiProviderCallStatus.SUCCEEDED
        assert call.latency_ms is not None


class TestGenerateStructured:
    async def test_returns_pages(self, db: AsyncSession):
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

    async def test_default_page_count(self, db: AsyncSession):
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
            pages=[{"id": 10, "page_no": 1, "narration_text": "你好"}],
        )
        assert result["page_results"] == [{"page_id": 10, "audio_url": "data:audio/wav;base64,abc"}]
