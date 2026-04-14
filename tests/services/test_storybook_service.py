"""
storybook_service 的单元测试
"""

import pytest

from app.models.enums import AgeGroup, CliType, Language, PageType, StoryType
from app.models.page import Page
from app.services import storybook_service


def make_page(page_type: PageType, text: str) -> Page:
    return Page(
        storybook_id=1,
        page_index=0,
        text=text,
        image_url="",
        page_type=page_type,
    )


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


class TestPickReferencePages:
    def test_returns_only_content_pages_when_three_or_fewer(self):
        pages = [
            make_page(PageType.COVER, "封面"),
            make_page(PageType.CONTENT, "内页1"),
            make_page(PageType.CONTENT, "内页2"),
            make_page(PageType.BACK_COVER, "封底"),
        ]

        result = storybook_service._pick_reference_pages(pages)

        assert [page.text for page in result] == ["内页1", "内页2"]

    def test_returns_first_middle_and_last_content_page_when_more_than_three(self):
        pages = [
            make_page(PageType.COVER, "封面"),
            make_page(PageType.CONTENT, "内页1"),
            make_page(PageType.CONTENT, "内页2"),
            make_page(PageType.CONTENT, "内页3"),
            make_page(PageType.CONTENT, "内页4"),
            make_page(PageType.CONTENT, "内页5"),
            make_page(PageType.BACK_COVER, "封底"),
        ]

        result = storybook_service._pick_reference_pages(pages)

        assert [page.text for page in result] == ["内页1", "内页3", "内页5"]

    def test_falls_back_to_all_pages_when_no_content_pages_exist(self):
        pages = [
            make_page(PageType.COVER, "封面"),
            make_page(PageType.BACK_COVER, "封底"),
        ]

        result = storybook_service._pick_reference_pages(pages)

        assert [page.text for page in result] == ["封面", "封底"]


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
