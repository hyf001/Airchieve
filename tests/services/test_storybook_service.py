"""
storybook_service 的单元测试
"""

import pytest

from app.models.enums import AgeGroup, CliType, Language, StoryType
from app.services import storybook_service


class FakeLLMClient:
    def __init__(self) -> None:
        self.create_story_calls = []
        self.create_storyboard_calls = []

    async def create_story(self, **kwargs):
        self.create_story_calls.append(kwargs)
        return "星星灯", "从前有一盏会说话的星星灯。"

    async def create_storyboard_from_story(self, **kwargs):
        self.create_storyboard_calls.append(kwargs)
        return ["第1页", "第2页"], [{"scene": "夜晚"}, {"scene": "黎明"}]


class TestBuildCoverStoryboard:
    def test_reuses_first_content_storyboard_character_fields(self):
        result = storybook_service.build_cover_storyboard(
            title="星星灯",
            story_content="小熊在森林里找到一盏会发光的灯，并学会勇敢。",
            content_storyboards=[
                None,
                {
                    "summary": "小熊抱着星星灯站在森林小路上。",
                    "scene": "森林小路",
                    "characters": "小熊抱着星星灯",
                    "shot": "中景",
                },
            ],
        )

        assert result["summary"] == "《星星灯》封面画面，突出主角和核心故事情境，形成清晰、有吸引力的绘本封面。"
        assert result["characters"] == "小熊抱着星星灯"
        assert "星星灯" in result["scene"]
        assert "小熊在森林里找到一盏会发光的灯" in result["scene"]
        assert "预留书名艺术字空间" in result["shot"]

    def test_uses_safe_defaults_when_content_storyboards_are_missing(self):
        result = storybook_service.build_cover_storyboard(
            title="月亮船",
            story_content="孩子坐着月亮船去拜访云朵。",
            content_storyboards=[None],
        )

        assert result["characters"] == "主角以温暖、清晰、有吸引力的姿态出现在画面中心"
        assert result["summary"] == "《月亮船》封面画面，突出主角和核心故事情境，形成清晰、有吸引力的绘本封面。"


class TestStoryGeneration:
    @pytest.mark.asyncio
    async def test_create_story_only_passes_expected_arguments_to_llm(self, monkeypatch):
        fake_client = FakeLLMClient()

        monkeypatch.setattr(
            storybook_service.LLMClientBase,
            "get_client",
            lambda cli_type: fake_client,
        )

        title, content = await storybook_service.create_story_only(
            instruction="写一个关于勇气的睡前故事",
            word_count=300,
            story_type=StoryType.BEDTIME_STORY,
            language=Language.EN,
            age_group=AgeGroup.AGE_6_8,
            cli_type=CliType.DOUBAO,
        )

        assert (title, content) == ("星星灯", "从前有一盏会说话的星星灯。")
        assert fake_client.create_story_calls == [{
            "instruction": "写一个关于勇气的睡前故事",
            "word_count": 300,
            "story_type": StoryType.BEDTIME_STORY,
            "language": Language.EN,
            "age_group": AgeGroup.AGE_6_8,
        }]

    @pytest.mark.asyncio
    async def test_create_storyboard_only_passes_expected_arguments_to_llm(self, monkeypatch):
        fake_client = FakeLLMClient()
        fake_style = type("Style", (), {"name": "水彩童话"})()
        fake_version = type("Version", (), {"style_summary": "柔和水彩"})()

        monkeypatch.setattr(
            storybook_service.LLMClientBase,
            "get_client",
            lambda cli_type: fake_client,
        )
        monkeypatch.setattr(
            storybook_service,
            "validate_style_available",
            lambda style_id: _async_return((fake_style, fake_version)),
        )

        story_texts, storyboards = await storybook_service.create_storyboard_only(
            story_content="一只小熊在森林里寻找回家的路。",
            page_count=8,
            cli_type=CliType.GEMINI,
            image_style_id=3,
        )

        assert story_texts == ["第1页", "第2页"]
        assert storyboards == [{"scene": "夜晚"}, {"scene": "黎明"}]
        assert fake_client.create_storyboard_calls == [{
            "story_content": "一只小熊在森林里寻找回家的路。",
            "page_count": 8,
            "style_name": "水彩童话",
            "style_summary": "柔和水彩",
            "storyboard_complexity": "保持适中画面层次，分镜复杂度服务于故事，不额外增加与故事无关的视觉元素。",
        }]


async def _async_return(value):
    return value
