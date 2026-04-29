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
        return (
            ["第1页", "第2页"],
            [
                {
                    "summary": "小熊在夜晚找到星星灯。",
                    "visual_brief": "小熊抱起星星灯",
                    "anchor_refs": ["bear_01"],
                    "must_include": ["小熊", "星星灯"],
                    "composition": "中景",
                    "avoid": ["文字"],
                },
                {
                    "summary": "黎明时小熊带着星星灯回家。",
                    "visual_brief": "小熊走向家的方向",
                    "anchor_refs": ["bear_01", "lamp_01"],
                    "must_include": ["小熊", "星星灯"],
                    "composition": "远景",
                    "avoid": ["文字"],
                },
            ],
            [
                {
                    "id": "bear_01",
                    "type": "character",
                    "name": "小熊",
                    "description": "温和的小熊",
                },
                {
                    "id": "lamp_01",
                    "type": "object",
                    "name": "星星灯",
                    "description": "会发光的灯",
                },
            ],
        )


class TestBuildCoverStoryboard:
    def test_reuses_first_content_storyboard_anchor_refs_and_must_include(self):
        result = storybook_service.build_cover_storyboard(
            title="星星灯",
            story_content="小熊在森林里找到一盏会发光的灯，并学会勇敢。",
            content_storyboards=[
                None,
                {
                    "summary": "小熊抱着星星灯站在森林小路上。",
                    "visual_brief": "小熊抱着星星灯站在森林小路上",
                    "anchor_refs": ["bear_01", "lamp_01", "forest_01", "extra_01"],
                    "must_include": ["小熊", "星星灯", "森林小路", "月光"],
                    "composition": "中景",
                    "avoid": ["文字"],
                },
            ],
        )

        assert result["summary"] == "《星星灯》封面画面，突出主角和核心故事情境，形成清晰、有吸引力的绘本封面。"
        assert result["anchor_refs"] == ["bear_01", "lamp_01", "forest_01"]
        assert result["must_include"] == ["小熊", "星星灯", "森林小路"]
        assert "星星灯" in result["visual_brief"]
        assert "小熊在森林里找到一盏会发光的灯" in result["visual_brief"]
        assert "预留书名艺术字空间" in result["composition"]

    def test_uses_safe_defaults_when_content_storyboards_are_missing(self):
        result = storybook_service.build_cover_storyboard(
            title="月亮船",
            story_content="孩子坐着月亮船去拜访云朵。",
            content_storyboards=[None],
        )

        assert result["anchor_refs"] == []
        assert result["must_include"] == ["主角", "核心故事情境"]
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

        story_texts, storyboards, visual_anchors = await storybook_service.create_storyboard_only(
            story_content="一只小熊在森林里寻找回家的路。",
            page_count=8,
            cli_type=CliType.GEMINI,
            image_style_id=3,
            has_character_reference_images=True,
        )

        assert story_texts == ["第1页", "第2页"]
        assert storyboards[0]["anchor_refs"] == ["bear_01"]
        assert visual_anchors == [
            {
                "id": "bear_01",
                "type": "character",
                "name": "小熊",
                "description": "温和的小熊",
            },
            {
                "id": "lamp_01",
                "type": "object",
                "name": "星星灯",
                "description": "会发光的灯",
            },
        ]
        assert fake_client.create_storyboard_calls == [{
            "story_content": "一只小熊在森林里寻找回家的路。",
            "page_count": 8,
            "style_name": "水彩童话",
            "style_summary": "柔和水彩",
            "storyboard_complexity": "保持适中画面层次，分镜复杂度服务于故事，不额外增加与故事无关的视觉元素。",
            "has_character_reference_images": True,
        }]


async def _async_return(value):
    return value
