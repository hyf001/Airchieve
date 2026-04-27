"""
page_service 的单元测试
"""

from datetime import datetime

import pytest

from app.models.enums import PageStatus, PageType
from app.models.page import Page
from app.schemas.page import PageResponse
from app.models.storybook import Storybook
from app.services import page_service


def make_page(
    page_id: int,
    page_type: PageType | str,
    image_url: str = "",
    text: str = "",
    status: PageStatus | str = PageStatus.PENDING,
    error_message: str | None = None,
) -> Page:
    page = Page(
        storybook_id=1,
        page_index=page_id,
        text=text or f"第{page_id}页",
        image_url=image_url,
        page_type=page_type,
        status=status,
        error_message=error_message,
    )
    page.id = page_id
    return page


class FakeScalarResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class FakeSession:
    def __init__(self, storybook):
        self.storybook = storybook

    async def execute(self, _query):
        return FakeScalarResult(self.storybook)


class TestBackCoverImageUrl:
    def test_returns_ratio_specific_back_cover_url(self, monkeypatch):
        monkeypatch.setattr(page_service.settings, "BACK_COVER_IMAGE_1_1", "oss://one-one")
        monkeypatch.setattr(page_service.settings, "BACK_COVER_IMAGE_4_3", "oss://four-three")
        monkeypatch.setattr(page_service.settings, "BACK_COVER_IMAGE_16_9", "oss://sixteen-nine")

        assert page_service.get_back_cover_image_url("4:3") == "oss://four-three"

    def test_falls_back_to_16_9_for_unknown_ratio(self, monkeypatch):
        monkeypatch.setattr(page_service.settings, "BACK_COVER_IMAGE_1_1", "")
        monkeypatch.setattr(page_service.settings, "BACK_COVER_IMAGE_4_3", "")
        monkeypatch.setattr(page_service.settings, "BACK_COVER_IMAGE_16_9", "oss://default")

        assert page_service.get_back_cover_image_url("3:2") == "oss://default"

    def test_raises_when_matching_and_fallback_urls_are_missing(self, monkeypatch):
        monkeypatch.setattr(page_service.settings, "BACK_COVER_IMAGE_1_1", "")
        monkeypatch.setattr(page_service.settings, "BACK_COVER_IMAGE_4_3", "")
        monkeypatch.setattr(page_service.settings, "BACK_COVER_IMAGE_16_9", "")

        with pytest.raises(ValueError, match="未配置封底图片"):
            page_service.get_back_cover_image_url("1:1")


class TestPickCoverReferencePages:
    def test_returns_all_generated_content_pages_when_three_or_fewer(self):
        pages = [
            make_page(1, PageType.COVER, image_url="cover.jpg"),
            make_page(2, PageType.CONTENT, image_url="content-1.jpg"),
            make_page(3, "content", image_url="content-2.jpg"),
            make_page(4, PageType.CONTENT, image_url=""),
            make_page(5, PageType.BACK_COVER, image_url="back.jpg"),
        ]

        result = page_service.pick_cover_reference_pages(pages)

        assert [page.image_url for page in result] == ["content-1.jpg", "content-2.jpg"]

    def test_returns_first_middle_and_last_generated_content_page_when_more_than_three(self):
        pages = [
            make_page(1, "content", image_url="content-1.jpg"),
            make_page(2, "content", image_url="content-2.jpg"),
            make_page(3, "content", image_url="content-3.jpg"),
            make_page(4, "content", image_url="content-4.jpg"),
            make_page(5, "content", image_url="content-5.jpg"),
        ]

        result = page_service.pick_cover_reference_pages(pages)

        assert [page.image_url for page in result] == [
            "content-1.jpg",
            "content-3.jpg",
            "content-5.jpg",
        ]


class TestPromptHelpers:
    def test_format_storyboard_for_prompt_returns_empty_string_without_storyboard(self):
        assert page_service.format_storyboard_for_prompt(None) == ""

    def test_build_cover_description_includes_text_and_storyboard(self):
        page = make_page(1, PageType.COVER, text="月亮船")
        page.storyboard = {
            "summary": "孩子坐着月亮船飞过夜空",
            "scene": "夜空",
            "characters": "孩子坐在月亮船上",
            "shot": "远景",
        }

        result = page_service.build_cover_description("备用标题", page)

        assert result.startswith("月亮船")
        assert "Cover storyboard:" in result
        assert "Summary: 孩子坐着月亮船飞过夜空" in result
        assert "Scene: 夜空" in result
        assert "Characters: 孩子坐在月亮船上" in result


class TestStoryboardSchemaCompatibility:
    def test_page_response_accepts_legacy_storyboard_without_summary(self):
        result = PageResponse.model_validate({
            "id": 1,
            "storybook_id": 1,
            "page_index": 0,
            "image_url": "image.png",
            "text": "旧页面",
            "page_type": "content",
            "status": "finished",
            "error_message": None,
            "storyboard": {
                "scene": "森林",
                "characters": "小熊走路",
                "shot": "中景",
                "color": "旧色调",
                "lighting": "旧光线",
            },
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
        })

        assert result.storyboard == {
            "scene": "森林",
            "characters": "小熊走路",
            "shot": "中景",
        }


class TestReferenceImageSelection:
    def test_selected_reference_image_urls_keeps_selected_generated_content_pages_only(self):
        pages = [
            make_page(1, PageType.CONTENT, image_url="keep.jpg"),
            make_page(2, "content", image_url="also-keep.jpg"),
            make_page(3, PageType.COVER, image_url="skip-cover.jpg"),
            make_page(4, PageType.CONTENT, image_url=""),
        ]

        result = page_service._selected_reference_image_urls(pages, [1, 2, 3, 4])

        assert result == ["keep.jpg", "also-keep.jpg"]


class TestSyncStorybookStatusFromPages:
    @pytest.mark.asyncio
    async def test_sets_error_when_any_page_failed(self):
        storybook = Storybook(title="测试书", creator="1", status="updating")
        storybook.pages = [
            make_page(1, PageType.CONTENT, status=PageStatus.FINISHED),
            make_page(2, PageType.CONTENT, status=PageStatus.ERROR, error_message="图片被拒绝"),
        ]

        result = await page_service.sync_storybook_status_from_pages(
            FakeSession(storybook),
            storybook_id=1,
            fallback_error="兜底错误",
        )

        assert result is storybook
        assert storybook.status == "error"
        assert storybook.error_message == "图片被拒绝"

    @pytest.mark.asyncio
    async def test_sets_active_status_when_pages_are_pending_or_generating(self):
        storybook = Storybook(title="测试书", creator="1", status="finished")
        storybook.pages = [
            make_page(1, "content", status="finished"),
            make_page(2, "content", status="pending"),
        ]

        await page_service.sync_storybook_status_from_pages(
            FakeSession(storybook),
            storybook_id=1,
            active_status="creating",
        )

        assert storybook.status == "creating"
        assert storybook.error_message is None

    @pytest.mark.asyncio
    async def test_sets_finished_when_all_pages_finished(self):
        storybook = Storybook(title="测试书", creator="1", status="updating", error_message="旧错误")
        storybook.pages = [
            make_page(1, PageType.COVER, status=PageStatus.FINISHED),
            make_page(2, "content", status="finished"),
        ]

        await page_service.sync_storybook_status_from_pages(FakeSession(storybook), storybook_id=1)

        assert storybook.status == "finished"
        assert storybook.error_message is None
