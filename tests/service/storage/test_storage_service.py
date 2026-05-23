from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.service.storage import service as storage_service


class _FakeBucket:
    def __init__(self, headers):
        self._headers = headers

    def get_object_meta(self, storage_key: str):
        return SimpleNamespace(headers=self._headers)


async def test_uploaded_object_size_rejects_missing_content_length(monkeypatch):
    monkeypatch.setattr(storage_service, "_get_oss_bucket", lambda: _FakeBucket({}))

    with pytest.raises(HTTPException) as exc_info:
        await storage_service._get_uploaded_object_size("uploads/voice/1/sample.mp3")

    assert exc_info.value.status_code == 400


async def test_uploaded_object_size_rejects_invalid_content_length(monkeypatch):
    monkeypatch.setattr(storage_service, "_get_oss_bucket", lambda: _FakeBucket({"Content-Length": "not-a-number"}))

    with pytest.raises(HTTPException) as exc_info:
        await storage_service._get_uploaded_object_size("uploads/voice/1/sample.mp3")

    assert exc_info.value.status_code == 400


def test_get_file_url_returns_public_oss_url(monkeypatch):
    monkeypatch.setattr(storage_service.settings, "OSS_BUCKET_NAME", "airchieve")
    monkeypatch.setattr(storage_service.settings, "OSS_ENDPOINT", "https://oss-cn-beijing.aliyuncs.com")

    url = storage_service.get_file_url("generated/image/2/test image.jpg", expires_in=60)

    assert url == "https://airchieve.oss-cn-beijing.aliyuncs.com/generated/image/2/test%20image.jpg"
    assert "Signature=" not in url
    assert "Expires=" not in url


def test_asset_storage_key_uses_character_reference_scope():
    key = storage_service._asset_storage_key(
        storage_service.AssetKind.IMAGE,
        42,
        "portrait.png",
        path_scope="character/reference",
    )

    assert key.startswith("asset/character/reference/user/42/")
    assert key.endswith(".png")
