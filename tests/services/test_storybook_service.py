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
    def test_reuses_first_content_storyboard_style_fields(self):
        result = storybook_service.build_cover_storyboard(
            title="星星灯",
            story_content="小熊在森林里找到一盏会发光的灯，并学会勇敢。",
            content_storyboards=[
                None,
                {
                    "scene": "森林小路",
                    "characters": "小熊抱着星星灯",
                    "shot": "中景",
                    "color": "蓝紫色夜晚",
                    "lighting": "星光柔和",
                },
            ],
        )

        assert result["characters"] == "小熊抱着星星灯"
        assert result["color"] == "蓝紫色夜晚"
        assert result["lighting"] == "星光柔和"
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
        assert result["color"] == "温暖明亮、适合儿童绘本的主色调"
        assert result["lighting"] == "柔和、有童话感的光线，突出封面主体"


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

        monkeypatch.setattr(
            storybook_service.LLMClientBase,
            "get_client",
            lambda cli_type: fake_client,
        )

        story_texts, storyboards = await storybook_service.create_storyboard_only(
            story_content="一只小熊在森林里寻找回家的路。",
            page_count=8,
            cli_type=CliType.GEMINI,
        )

        assert story_texts == ["第1页", "第2页"]
        assert storyboards == [{"scene": "夜晚"}, {"scene": "黎明"}]
        assert fake_client.create_storyboard_calls == [{
            "story_content": "一只小熊在森林里寻找回家的路。",
            "page_count": 8,
        }]
