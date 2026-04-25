"""
image_style_service 的单元测试
"""

from datetime import datetime, timezone

import pytest

from app.models.image_style import ImageStyle, ImageStyleReferenceImage, ImageStyleVersion
from app.services import image_style_service


class FakeScalarResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value

    def scalar_one(self):
        return self.value


class FakeSession:
    def __init__(self, results):
        self.results = list(results)
        self.added = []
        self.committed = False
        self.refreshed = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, traceback):
        return False

    async def execute(self, _query):
        if self.results:
            return FakeScalarResult(self.results.pop(0))
        version = next(
            (item for item in self.added if isinstance(item, ImageStyleVersion)),
            None,
        )
        return FakeScalarResult(version)

    def add(self, item):
        self.added.append(item)

    async def flush(self):
        for index, item in enumerate(self.added, start=1):
            if getattr(item, "id", None) is None:
                item.id = index

    async def commit(self):
        self.committed = True

    async def refresh(self, item):
        self.refreshed.append(item)


def make_style() -> ImageStyle:
    return ImageStyle(
        name="水彩童话",
        description="柔和水彩",
        cover_image="https://example.com/cover.png",
        tags=["watercolor"],
        creator="1",
        is_active=True,
        sort_order=10,
    )


def make_complete_version() -> ImageStyleVersion:
    reference_image = ImageStyleReferenceImage(
        image_style_version_id=1,
        url="https://example.com/ref.png",
        is_cover=True,
        sort_order=0,
        creator="1",
    )
    return ImageStyleVersion(
        image_style_id=1,
        version_no="v1",
        style_summary="柔和温暖",
        style_description="低饱和水彩童话风",
        generation_prompt="Use watercolor textures.",
        negative_prompt="No harsh shadows.",
        reference_images=[reference_image],
        status="draft",
        creator="1",
    )


class TestImageStyleService:
    def test_validate_style_version_complete_accepts_complete_version(self):
        version = make_complete_version()

        image_style_service.validate_style_version_complete(version)

    def test_validate_style_version_complete_rejects_blank_prompt(self):
        version = make_complete_version()
        version.generation_prompt = "  "

        with pytest.raises(image_style_service.IncompleteImageStyleVersionError):
            image_style_service.validate_style_version_complete(version)

    @pytest.mark.asyncio
    async def test_list_image_styles_returns_empty_when_inactive_is_requested(self, monkeypatch):
        def fail_if_used():
            raise AssertionError("inactive public list should not open a database session")

        monkeypatch.setattr(image_style_service, "async_session_maker", fail_if_used)

        result = await image_style_service.list_image_styles(is_active=False)

        assert result == []

    @pytest.mark.asyncio
    async def test_create_style_version_uses_next_version_number(self, monkeypatch):
        style = make_style()
        fake_session = FakeSession([style, 2])
        monkeypatch.setattr(image_style_service, "async_session_maker", lambda: fake_session)

        version = await image_style_service.create_style_version(
            style_id=1,
            creator="7",
            style_summary="摘要",
            reference_images=[
                image_style_service.ReferenceImageInput(
                    url="https://example.com/ref.png",
                )
            ],
        )

        assert version.version_no == "v3"
        assert version.image_style_id == 1
        assert version.creator == "7"
        assert fake_session.added[0] is version
        assert isinstance(fake_session.added[1], ImageStyleReferenceImage)
        assert fake_session.added[1].url == "https://example.com/ref.png"
        assert fake_session.committed is True

    @pytest.mark.asyncio
    async def test_update_image_style_can_clear_nullable_fields(self, monkeypatch):
        style = make_style()
        style.created_at = datetime.now(timezone.utc)
        style.updated_at = datetime.now(timezone.utc)
        fake_session = FakeSession([style])
        monkeypatch.setattr(image_style_service, "async_session_maker", lambda: fake_session)

        result = await image_style_service.update_image_style(
            style_id=1,
            modifier="7",
            description=None,
            cover_image=None,
        )

        assert result is style
        assert style.description is None
        assert style.cover_image is None
        assert style.name == "水彩童话"
        assert style.modifier == "7"
