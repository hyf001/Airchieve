"""
image_style_service 的单元测试
"""

from datetime import datetime, timezone

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db.base import Base
from app.models.image_style import (
    ImageStyle,
    ImageStyleAsset,
    ImageStyleReferenceImage,
    ImageStyleVersion,
)
from app.services import image_style_service


class FakeScalarResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value

    def scalar_one(self):
        return self.value

    def all(self):
        return self.value

    def scalars(self):
        return self

    # scalars().all() chains back to .all()


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

    async def refresh(self, item, *args, **kwargs):
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


def make_asset(**overrides) -> ImageStyleAsset:
    data = {
        "id": 3,
        "url": "https://example.com/ref.png",
        "object_key": "image-style-assets/ref.png",
        "name": "参考图",
        "content_type": "image/png",
        "file_size": 128,
        "creator": "1",
    }
    data.update(overrides)
    return ImageStyleAsset(**data)


def make_complete_version() -> ImageStyleVersion:
    reference_image = ImageStyleReferenceImage(
        image_style_version_id=1,
        asset_id=3,
        url_snapshot="https://example.com/ref.png",
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
    async def test_list_image_style_assets_filters_tag_before_pagination(self, monkeypatch):
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        TestSession = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with TestSession() as session:
            session.add_all(
                [
                    make_asset(id=1, tags=["水彩"], created_at=datetime(2026, 1, 3, tzinfo=timezone.utc)),
                    make_asset(id=2, tags=["奇幻"], created_at=datetime(2026, 1, 2, tzinfo=timezone.utc)),
                    make_asset(id=3, color_tags=["水彩"], created_at=datetime(2026, 1, 1, tzinfo=timezone.utc)),
                ]
            )
            await session.commit()
        monkeypatch.setattr(image_style_service, "async_session_maker", TestSession)

        try:
            result = await image_style_service.list_image_style_assets(
                tag="水彩",
                limit=1,
                offset=1,
            )
        finally:
            await engine.dispose()

        assert [asset.id for asset, _count in result] == [3]

    @pytest.mark.asyncio
    async def test_create_style_version_uses_next_version_number(self, monkeypatch):
        style = make_style()
        asset = make_asset()
        fake_session = FakeSession([style, 2, asset])
        monkeypatch.setattr(image_style_service, "async_session_maker", lambda: fake_session)

        version = await image_style_service.create_style_version(
            style_id=1,
            creator="7",
            style_summary="摘要",
            reference_images=[
                image_style_service.ReferenceImageInput(
                    asset_id=3,
                )
            ],
        )

        assert version.version_no == "v3"
        assert version.image_style_id == 1
        assert version.creator == "7"
        assert fake_session.added[0] is version
        assert isinstance(fake_session.added[1], ImageStyleReferenceImage)
        assert fake_session.added[1].asset_id == 3
        assert fake_session.added[1].url == "https://example.com/ref.png"
        assert fake_session.committed is True

    @pytest.mark.asyncio
    async def test_publish_style_version_snapshots_reference_urls_and_cover(self, monkeypatch):
        style = make_style()
        style.id = 1
        asset_cover = make_asset(id=4, url="https://example.com/cover-ref.png")
        asset_other = make_asset(id=5, url="https://example.com/other-ref.png")
        version = ImageStyleVersion(
            id=11,
            image_style_id=1,
            version_no="v1",
            style_summary="柔和温暖",
            style_description="低饱和水彩童话风",
            generation_prompt="Use watercolor textures.",
            negative_prompt="No harsh shadows.",
            reference_images=[
                ImageStyleReferenceImage(
                    id=20,
                    image_style_version_id=11,
                    asset_id=5,
                    asset=asset_other,
                    is_cover=False,
                    sort_order=2,
                    creator="1",
                ),
                ImageStyleReferenceImage(
                    id=21,
                    image_style_version_id=11,
                    asset_id=4,
                    asset=asset_cover,
                    is_cover=False,
                    sort_order=1,
                    creator="1",
                ),
            ],
            status="draft",
            creator="1",
        )
        fake_session = FakeSession([style, version, version])
        monkeypatch.setattr(image_style_service, "async_session_maker", lambda: fake_session)

        result = await image_style_service.publish_style_version(style_id=1, version_id=11)

        assert result.status == "published"
        assert style.current_version_id == 11
        assert style.cover_image == "https://example.com/cover-ref.png"
        assert version.reference_images[0].url_snapshot == "https://example.com/other-ref.png"
        assert version.reference_images[1].url_snapshot == "https://example.com/cover-ref.png"
        assert version.reference_images[1].is_cover is True
        assert fake_session.committed is True

    @pytest.mark.asyncio
    async def test_update_reference_image_rejects_published_version(self, monkeypatch):
        version = make_complete_version()
        version.id = 11
        version.status = "published"
        fake_session = FakeSession([version, version])
        monkeypatch.setattr(image_style_service, "async_session_maker", lambda: fake_session)

        with pytest.raises(image_style_service.ImageStyleVersionImmutableError):
            await image_style_service.update_reference_image(
                style_id=1,
                version_id=11,
                image_id=20,
                is_cover=True,
            )

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

    # ---- 三期新增 ----

    def test_validate_style_version_complete_rejects_empty_reference_images(self):
        version = make_complete_version()
        version.reference_images = []

        with pytest.raises(image_style_service.IncompleteImageStyleVersionError):
            image_style_service.validate_style_version_complete(version)

    def test_reference_image_url_prefers_snapshot(self):
        image = ImageStyleReferenceImage(
            image_style_version_id=1,
            asset_id=3,
            url_snapshot="https://example.com/snapshot.png",
            is_cover=True,
            sort_order=0,
            creator="1",
        )
        image.asset = make_asset(url="https://example.com/asset.png")

        assert image.url == "https://example.com/snapshot.png"

    def test_reference_image_url_falls_back_to_asset(self):
        image = ImageStyleReferenceImage(
            image_style_version_id=1,
            asset_id=3,
            is_cover=True,
            sort_order=0,
            creator="1",
        )
        image.asset = make_asset(url="https://example.com/asset.png")

        assert image.url == "https://example.com/asset.png"

    def test_reference_image_url_falls_back_to_legacy(self):
        image = ImageStyleReferenceImage(
            image_style_version_id=1,
            asset_id=None,
            legacy_url="https://example.com/legacy.png",
            is_cover=True,
            sort_order=0,
            creator="1",
        )
        image.asset = None

        assert image.url == "https://example.com/legacy.png"

    @pytest.mark.asyncio
    async def test_create_image_style_asset_persists_fields(self, monkeypatch):
        fake_session = FakeSession([])
        monkeypatch.setattr(image_style_service, "async_session_maker", lambda: fake_session)

        result = await image_style_service.create_image_style_asset(
            url="https://example.com/img.png",
            object_key="image-style-assets/2026/01/abc.png",
            name="测试图片",
            content_type="image/png",
            file_size=1024,
            creator="1",
            tags=["水彩"],
            width=100,
            height=80,
        )

        assert fake_session.committed is True
        assert fake_session.added[0] is result
        assert result.url == "https://example.com/img.png"
        assert result.name == "测试图片"
        assert result.tags == ["水彩"]
        assert result.width == 100

    @pytest.mark.asyncio
    async def test_update_image_style_asset_partial_update(self, monkeypatch):
        asset = make_asset()
        fake_session = FakeSession([asset])
        monkeypatch.setattr(image_style_service, "async_session_maker", lambda: fake_session)

        result = await image_style_service.update_image_style_asset(
            asset_id=3,
            modifier="2",
            name="新名称",
        )

        assert result is asset
        assert asset.name == "新名称"
        assert asset.modifier == "2"
        assert fake_session.committed is True

    @pytest.mark.asyncio
    async def test_delete_image_style_asset_succeeds_when_unreferenced(self, monkeypatch):
        asset = make_asset()
        fake_session = FakeSession([asset, 0])
        monkeypatch.setattr(image_style_service, "async_session_maker", lambda: fake_session)

        await image_style_service.delete_image_style_asset(asset_id=3)

        assert fake_session.committed is True

    @pytest.mark.asyncio
    async def test_delete_image_style_asset_rejects_when_referenced(self, monkeypatch):
        asset = make_asset()
        fake_session = FakeSession([asset, 5])
        monkeypatch.setattr(image_style_service, "async_session_maker", lambda: fake_session)

        with pytest.raises(image_style_service.ImageStyleAssetInUseError):
            await image_style_service.delete_image_style_asset(asset_id=3)

    @pytest.mark.asyncio
    async def test_update_style_version_allows_draft(self, monkeypatch):
        version = make_complete_version()
        version.id = 11
        fake_session = FakeSession([version, version])
        monkeypatch.setattr(image_style_service, "async_session_maker", lambda: fake_session)

        result = await image_style_service.update_style_version(
            style_id=1,
            version_id=11,
            style_summary="新摘要",
        )

        assert result is version
        assert version.style_summary == "新摘要"
        assert fake_session.committed is True

    @pytest.mark.asyncio
    async def test_update_style_version_rejects_published(self, monkeypatch):
        version = make_complete_version()
        version.id = 11
        version.status = "published"
        fake_session = FakeSession([version])
        monkeypatch.setattr(image_style_service, "async_session_maker", lambda: fake_session)

        with pytest.raises(image_style_service.ImageStyleVersionImmutableError):
            await image_style_service.update_style_version(
                style_id=1,
                version_id=11,
                style_summary="新摘要",
            )

    @pytest.mark.asyncio
    async def test_delete_style_version_allows_draft(self, monkeypatch):
        version = make_complete_version()
        version.id = 11
        fake_session = FakeSession([version])
        monkeypatch.setattr(image_style_service, "async_session_maker", lambda: fake_session)

        await image_style_service.delete_style_version(style_id=1, version_id=11)

        assert fake_session.committed is True

    @pytest.mark.asyncio
    async def test_delete_style_version_rejects_published(self, monkeypatch):
        version = make_complete_version()
        version.id = 11
        version.status = "published"
        fake_session = FakeSession([version])
        monkeypatch.setattr(image_style_service, "async_session_maker", lambda: fake_session)

        with pytest.raises(image_style_service.ImageStyleVersionImmutableError):
            await image_style_service.delete_style_version(style_id=1, version_id=11)

    @pytest.mark.asyncio
    async def test_create_reference_image_auto_sort_order(self, monkeypatch):
        version = make_complete_version()
        version.id = 11
        asset = make_asset()
        fake_session = FakeSession([version, asset, 5])
        monkeypatch.setattr(image_style_service, "async_session_maker", lambda: fake_session)

        result = await image_style_service.create_reference_image(
            style_id=1,
            version_id=11,
            creator="1",
            asset_id=3,
        )

        assert result.sort_order == 6

    @pytest.mark.asyncio
    async def test_create_reference_image_rejects_published_version(self, monkeypatch):
        version = make_complete_version()
        version.id = 11
        version.status = "published"
        fake_session = FakeSession([version])
        monkeypatch.setattr(image_style_service, "async_session_maker", lambda: fake_session)

        with pytest.raises(image_style_service.ImageStyleVersionImmutableError):
            await image_style_service.create_reference_image(
                style_id=1,
                version_id=11,
                creator="1",
                asset_id=3,
            )

    @pytest.mark.asyncio
    async def test_delete_reference_image_auto_switches_cover(self, monkeypatch):
        cover_image = ImageStyleReferenceImage(
            id=20, image_style_version_id=11, asset_id=3,
            is_cover=True, sort_order=0, creator="1",
        )
        cover_image.asset = make_asset(url="https://example.com/a.png")
        other_image = ImageStyleReferenceImage(
            id=21, image_style_version_id=11, asset_id=4,
            is_cover=False, sort_order=1, creator="1",
        )
        other_image.asset = make_asset(id=4, url="https://example.com/b.png")
        version = make_complete_version()
        version.id = 11
        version.reference_images = [cover_image, other_image]
        # execute calls: select version, select image, delete image, select next_cover
        fake_session = FakeSession([version, cover_image, None, other_image])
        monkeypatch.setattr(image_style_service, "async_session_maker", lambda: fake_session)

        await image_style_service.delete_reference_image(
            style_id=1, version_id=11, image_id=20,
        )

        assert other_image.is_cover is True
        assert fake_session.committed is True

    @pytest.mark.asyncio
    async def test_get_reference_image_urls_returns_resolved_urls(self, monkeypatch):
        img1 = ImageStyleReferenceImage(
            id=20, image_style_version_id=11, asset_id=3,
            url_snapshot="https://example.com/snap.png",
            is_cover=True, sort_order=0, creator="1",
        )
        img2 = ImageStyleReferenceImage(
            id=21, image_style_version_id=11, asset_id=4,
            is_cover=False, sort_order=1, creator="1",
        )
        img2.asset = make_asset(id=4, url="https://example.com/asset.png")
        fake_session = FakeSession([[img1, img2]])
        monkeypatch.setattr(image_style_service, "async_session_maker", lambda: fake_session)

        urls = await image_style_service.get_reference_image_urls(version_id=11)

        assert urls == ["https://example.com/snap.png", "https://example.com/asset.png"]
