from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.service.storage import service as storage_service


class _FakeBucket:
    def __init__(self, headers):
        self._headers = headers
        self.objects = {}

    def get_object_meta(self, storage_key: str):
        return SimpleNamespace(headers=self._headers)

    def put_object(self, storage_key: str, content: bytes, headers=None):
        self.objects[storage_key] = (content, headers or {})


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


async def test_save_generated_url_downloads_and_stores_audio(monkeypatch, db):
    bucket = _FakeBucket({})
    monkeypatch.setattr(storage_service, "_get_oss_bucket", lambda: bucket)
    monkeypatch.setattr(storage_service.settings, "OSS_BUCKET_NAME", "airchieve")
    monkeypatch.setattr(storage_service.settings, "OSS_ENDPOINT", "https://oss-cn-beijing.aliyuncs.com")

    async def fake_download(url: str, *, asset_kind):
        assert url == "https://kling.example.com/audio"
        assert asset_kind == storage_service.AssetKind.AUDIO
        return b"mp3-bytes", "audio/mpeg"

    monkeypatch.setattr(storage_service, "_download_generated_url", fake_download)

    result = await storage_service.save_generated_url(
        db,
        None,
        url="https://kling.example.com/audio",
        asset_kind=storage_service.AssetKind.AUDIO,
        visibility=storage_service.AssetVisibility.SYSTEM,
        path_scope="voice/sample",
    )

    assert result.storage_key.startswith("asset/voice/sample/user/system/")
    assert result.storage_key.endswith(".mp3")
    assert bucket.objects[result.storage_key] == (b"mp3-bytes", {"Content-Type": "audio/mpeg"})
    assert result.mime_type == "audio/mpeg"
    assert result.byte_size == len(b"mp3-bytes")
