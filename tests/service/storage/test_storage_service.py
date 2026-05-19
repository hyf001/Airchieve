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
