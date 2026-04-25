"""
image_style_api 的接口测试
"""

from datetime import datetime, timezone
from types import SimpleNamespace

from fastapi.testclient import TestClient

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
        "reference_images": [
            {
                "url": "https://example.com/ref.png",
                "is_cover": True,
                "sort_order": 0,
                "note": None,
            }
        ],
        "status": "published",
        "creator": "7",
        "created_at": datetime.now(timezone.utc),
        "published_at": datetime.now(timezone.utc),
    }
    data.update(overrides)
    return SimpleNamespace(**data)


def override_admin():
    return SimpleNamespace(id=7, role="admin")


def test_list_image_styles_returns_public_published_styles(monkeypatch):
    async def fake_list_image_styles(**kwargs):
        assert kwargs == {"is_active": True, "limit": 100, "offset": 0}
        return [(make_style(), make_version())]

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
                        "url": "https://example.com/ref.png",
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
            url="https://example.com/ref.png",
            is_cover=True,
            sort_order=3,
            note="封面参考",
        )
    ]
