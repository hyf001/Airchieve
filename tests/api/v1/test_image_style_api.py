"""
image_style_api 的接口测试
"""

from datetime import datetime, timezone
from io import BytesIO
from types import SimpleNamespace

from fastapi.testclient import TestClient
from PIL import Image

from app.main import app
from app.api.v1 import image_style_api
from app.services import image_style_service


client = TestClient(app)


def make_style(**overrides):
    data = {
        "id": 1,
        "name": "水彩童话",
        "description": "柔和水彩",
        "cover_image": "https://example.com/cover.png",
        "tags": ["watercolor"],
        "current_version_id": 11,
        "is_active": True,
        "sort_order": 10,
        "creator": "7",
        "modifier": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    data.update(overrides)
    return SimpleNamespace(**data)


def make_version(**overrides):
    data = {
        "id": 11,
        "image_style_id": 1,
        "version_no": "v1",
        "style_summary": "柔和温暖",
        "style_description": "低饱和水彩童话风",
        "generation_prompt": "Use watercolor textures.",
        "negative_prompt": "No harsh shadows.",
        "reference_images": [],
        "status": "published",
        "creator": "7",
        "created_at": datetime.now(timezone.utc),
        "published_at": datetime.now(timezone.utc),
    }
    data.update(overrides)
    return SimpleNamespace(**data)


def override_admin():
    return SimpleNamespace(id=7, role="admin")


def make_asset(**overrides):
    data = {
        "id": 3,
        "url": "https://example.com/ref.png",
        "object_key": "image-style-assets/ref.png",
        "name": "参考图",
        "description": None,
        "tags": ["水彩"],
        "style_type": "水彩",
        "color_tags": ["柔和"],
        "texture_tags": [],
        "scene_tags": [],
        "subject_tags": [],
        "composition_tags": [],
        "age_group_tags": [],
        "content_type": "image/png",
        "file_size": 78,
        "width": 2,
        "height": 2,
        "is_active": True,
        "creator": "7",
        "modifier": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    data.update(overrides)
    return SimpleNamespace(**data)


def make_png_bytes() -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (2, 2), color="white").save(buffer, format="PNG")
    return buffer.getvalue()


def test_list_image_styles_returns_public_published_styles(monkeypatch):
    style = make_style()

    async def fake_list_image_styles(**kwargs):
        assert kwargs == {"is_active": True, "limit": 100, "offset": 0}
        return [(style, make_version())]

    monkeypatch.setattr(image_style_api, "list_image_styles", fake_list_image_styles)

    response = client.get("/api/v1/image-styles")

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": 1,
            "name": "水彩童话",
            "description": "柔和水彩",
            "cover_image": "https://example.com/cover.png",
            "tags": ["watercolor"],
            "current_version_id": 11,
            "current_version_no": "v1",
            "is_active": True,
            "updated_at": style.updated_at.isoformat().replace("+00:00", "Z"),
            "sort_order": 10,
        }
    ]


def test_get_image_style_returns_404_when_service_cannot_find_style(monkeypatch):
    async def fake_get_image_style(_style_id):
        raise image_style_service.ImageStyleNotFoundError("missing")

    monkeypatch.setattr(image_style_api, "get_image_style", fake_get_image_style)

    response = client.get("/api/v1/image-styles/999")

    assert response.status_code == 404
    assert response.json() == {"detail": "画风不存在"}


def test_update_image_style_preserves_explicit_null_fields(monkeypatch):
    captured = {}

    async def fake_update_image_style(**kwargs):
        captured.update(kwargs)
        return make_style(description=None, cover_image=None, current_version_id=None)

    app.dependency_overrides[image_style_api.require_image_style_admin] = override_admin
    monkeypatch.setattr(image_style_api, "update_image_style", fake_update_image_style)

    try:
        response = client.put(
            "/api/v1/image-styles/1",
            json={"description": None, "cover_image": None},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["style_id"] == 1
    assert captured["modifier"] == "7"
    assert captured["description"] is None
    assert captured["cover_image"] is None
    assert captured["name"] is image_style_service.UNSET
    assert response.json()["description"] is None
    assert response.json()["cover_image"] is None


def test_create_style_version_returns_404_when_parent_style_is_missing(monkeypatch):
    captured = {}

    async def fake_create_style_version(**kwargs):
        captured.update(kwargs)
        raise image_style_service.ImageStyleNotFoundError("missing")

    app.dependency_overrides[image_style_api.require_image_style_admin] = override_admin
    monkeypatch.setattr(image_style_api, "create_style_version", fake_create_style_version)

    try:
        response = client.post(
            "/api/v1/image-styles/404/versions",
            json={
                "style_summary": "摘要",
                "reference_images": [
                    {
                        "asset_id": 3,
                        "is_cover": True,
                        "sort_order": 3,
                        "note": "封面参考",
                    }
                ],
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404
    assert response.json() == {"detail": "画风不存在"}
    assert captured["style_id"] == 404
    assert captured["reference_images"] == [
        image_style_service.ReferenceImageInput(
            asset_id=3,
            is_cover=True,
            sort_order=3,
            note="封面参考",
        )
    ]


def test_upload_image_style_asset_validates_image_and_persists_metadata(monkeypatch):
    captured = {}

    async def fake_upload_bytes(data, object_key, content_type):
        captured["upload"] = {
            "data": data,
            "object_key": object_key,
            "content_type": content_type,
        }
        return "https://example.com/uploaded.png"

    async def fake_create_image_style_asset(**kwargs):
        captured["asset"] = kwargs
        return make_asset(
            url=kwargs["url"],
            object_key=kwargs["object_key"],
            name=kwargs["name"],
            tags=kwargs["tags"],
            color_tags=kwargs["color_tags"],
            file_size=kwargs["file_size"],
            width=kwargs["width"],
            height=kwargs["height"],
        )

    app.dependency_overrides[image_style_api.require_image_style_admin] = override_admin
    monkeypatch.setattr(image_style_api.oss_service, "upload_bytes", fake_upload_bytes)
    monkeypatch.setattr(image_style_api, "create_image_style_asset", fake_create_image_style_asset)

    try:
        response = client.post(
            "/api/v1/image-style-assets/upload",
            files={"file": ("ref.png", make_png_bytes(), "image/png")},
            data={
                "name": "参考图",
                "tags": ["水彩,儿童", "柔和"],
                "color_tags": ["暖色"],
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert captured["upload"]["content_type"] == "image/png"
    assert captured["upload"]["object_key"].startswith("image-style-assets/")
    assert captured["asset"]["url"] == "https://example.com/uploaded.png"
    assert captured["asset"]["tags"] == ["水彩", "儿童", "柔和"]
    assert captured["asset"]["color_tags"] == ["暖色"]
    assert captured["asset"]["width"] == 2
    assert captured["asset"]["height"] == 2
    assert response.json()["reference_count"] == 0


# ---- 三期新增 API 测试 ----


def test_list_admin_image_styles_returns_all_styles(monkeypatch):
    active_style = make_style(id=1, name="启用风格", is_active=True)
    inactive_style = make_style(id=2, name="停用风格", is_active=False)
    unpublished = make_style(id=3, name="未发布", current_version_id=None, is_active=True)

    async def fake_list_admin(**kwargs):
        assert kwargs["is_active"] is None
        return [(active_style, make_version()), (inactive_style, None), (unpublished, None)]

    app.dependency_overrides[image_style_api.require_image_style_admin] = override_admin
    monkeypatch.setattr(image_style_api, "list_admin_image_styles", fake_list_admin)

    try:
        response = client.get("/api/v1/image-styles/admin")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    assert data[1]["is_active"] is False
    assert data[1]["current_version_id"] is None
    assert data[2]["current_version_no"] is None


def test_update_style_version_endpoint_allows_draft(monkeypatch):
    draft_version = make_version(status="draft", style_summary="旧摘要")

    async def fake_update(**kwargs):
        draft_version.style_summary = kwargs["style_summary"]
        return draft_version

    app.dependency_overrides[image_style_api.require_image_style_admin] = override_admin
    monkeypatch.setattr(image_style_api, "update_style_version", fake_update)

    try:
        response = client.put(
            "/api/v1/image-styles/1/versions/11",
            json={"style_summary": "新摘要"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["style_summary"] == "新摘要"


def test_update_style_version_endpoint_rejects_published(monkeypatch):
    async def fake_update(**kwargs):
        raise image_style_service.ImageStyleVersionImmutableError("已发布版本不可编辑")

    app.dependency_overrides[image_style_api.require_image_style_admin] = override_admin
    monkeypatch.setattr(image_style_api, "update_style_version", fake_update)

    try:
        response = client.put(
            "/api/v1/image-styles/1/versions/11",
            json={"style_summary": "新摘要"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 400
    assert response.json() == {"detail": "已发布版本不可编辑"}


def test_delete_style_version_endpoint_allows_draft(monkeypatch):
    async def fake_delete(style_id, version_id):
        pass

    app.dependency_overrides[image_style_api.require_image_style_admin] = override_admin
    monkeypatch.setattr(image_style_api, "delete_style_version", fake_delete)

    try:
        response = client.delete("/api/v1/image-styles/1/versions/11")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 204


def test_delete_style_version_endpoint_rejects_published(monkeypatch):
    async def fake_delete(style_id, version_id):
        raise image_style_service.ImageStyleVersionImmutableError("已发布版本不可删除")

    app.dependency_overrides[image_style_api.require_image_style_admin] = override_admin
    monkeypatch.setattr(image_style_api, "delete_style_version", fake_delete)

    try:
        response = client.delete("/api/v1/image-styles/1/versions/11")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 400
    assert response.json() == {"detail": "已发布版本不可删除"}


def test_list_image_style_assets_endpoint(monkeypatch):
    asset = make_asset()

    async def fake_list(**kwargs):
        assert kwargs["is_active"] is True
        return [(asset, 2)]

    app.dependency_overrides[image_style_api.require_image_style_admin] = override_admin
    monkeypatch.setattr(image_style_api, "list_image_style_assets", fake_list)

    try:
        response = client.get("/api/v1/image-style-assets?is_active=true")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["reference_count"] == 2


def test_update_image_style_asset_endpoint(monkeypatch):
    asset = make_asset(name="新名称")

    async def fake_update_asset(**kwargs):
        return asset

    async def fake_get_asset(_id):
        return asset, 0

    app.dependency_overrides[image_style_api.require_image_style_admin] = override_admin
    monkeypatch.setattr(image_style_api, "update_image_style_asset", fake_update_asset)
    monkeypatch.setattr(image_style_api, "get_image_style_asset", fake_get_asset)

    try:
        response = client.put(
            "/api/v1/image-style-assets/3",
            json={"name": "新名称"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["name"] == "新名称"


def test_delete_image_style_asset_endpoint_unreferenced(monkeypatch):
    async def fake_delete(asset_id):
        pass

    app.dependency_overrides[image_style_api.require_image_style_admin] = override_admin
    monkeypatch.setattr(image_style_api, "delete_image_style_asset", fake_delete)

    try:
        response = client.delete("/api/v1/image-style-assets/3")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 204


def test_delete_image_style_asset_endpoint_referenced_returns_409(monkeypatch):
    async def fake_delete(asset_id):
        raise image_style_service.ImageStyleAssetInUseError("图片资产已被风格版本引用，只能下架")

    app.dependency_overrides[image_style_api.require_image_style_admin] = override_admin
    monkeypatch.setattr(image_style_api, "delete_image_style_asset", fake_delete)

    try:
        response = client.delete("/api/v1/image-style-assets/3")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409
    assert "引用" in response.json()["detail"]


def test_upload_image_style_asset_rejects_non_image(monkeypatch):
    app.dependency_overrides[image_style_api.require_image_style_admin] = override_admin

    try:
        response = client.post(
            "/api/v1/image-style-assets/upload",
            files={"file": ("test.txt", b"hello", "text/plain")},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 400
    assert "PNG" in response.json()["detail"]


def test_create_reference_image_endpoint_rejects_published_version(monkeypatch):
    async def fake_create(**kwargs):
        raise image_style_service.ImageStyleVersionImmutableError("已发布版本的参考图不可修改")

    app.dependency_overrides[image_style_api.require_image_style_admin] = override_admin
    monkeypatch.setattr(image_style_api, "create_reference_image", fake_create)

    try:
        response = client.post(
            "/api/v1/image-styles/1/versions/11/reference-images",
            json={"asset_id": 3, "is_cover": True},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 400
    assert "不可修改" in response.json()["detail"]


def test_publish_style_version_endpoint_returns_version_response(monkeypatch):
    published = make_version(status="published")

    async def fake_publish(style_id, version_id):
        assert style_id == 1
        assert version_id == 11
        return published

    app.dependency_overrides[image_style_api.require_image_style_admin] = override_admin
    monkeypatch.setattr(image_style_api, "publish_style_version", fake_publish)

    try:
        response = client.post("/api/v1/image-styles/1/versions/11/publish")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["status"] == "published"
