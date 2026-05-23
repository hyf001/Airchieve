"""Tests for asset_api and privacy_api endpoints: auth, validation, response shape."""

from unittest.mock import AsyncMock, patch
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

# Fixed user IDs used by dependency overrides
USER_ID = 42
OTHER_USER_ID = 99


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _character_payload(**overrides):
    payload = {
        "id": 1,
        "owner_user_id": USER_ID,
        "name": "Char",
        "description": None,
        "image_url": None,
        "art_style_id": None,
        "access_level": "free",
        "source_type": "ai_generated",
        "is_default": False,
        "status": "active",
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
        "reference_character_id": None,
        "generation_prompt": None,
        "category_code": None,
        "art_style": None,
    }
    payload.update(overrides)
    return payload


def _art_style_payload(**overrides):
    payload = {
        "id": 5,
        "owner_user_id": USER_ID,
        "code": None,
        "name": "My Style",
        "description": "A custom style",
        "prompt": None,
        "example_asset_id": None,
        "example_url": None,
        "age_range_codes": [],
        "access_level": "free",
        "sort_order": 0,
        "status": "active",
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    payload.update(overrides)
    return payload


def _voice_payload(**overrides):
    payload = {
        "id": 3,
        "owner_user_id": USER_ID,
        "name": "Mom",
        "voice_style_code": None,
        "sample_asset_id": None,
        "sample_url": None,
        "supported_languages": ["zh"],
        "duration_seconds": None,
        "access_level": "free",
        "source_type": "user_upload",
        "processing_status": "processing",
        "failure_reason": None,
        "is_default": False,
        "moderation_status": "approved",
        "status": "active",
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
        "source_sample_asset_id": None,
    }
    payload.update(overrides)
    return payload


# ---------------------------------------------------------------------------
# Dependency overrides
# ---------------------------------------------------------------------------

def _override_auth(user_id: int | None, *, optional: bool = False):
    """Override auth dependencies to return a fixed user_id."""

    async def _current_user_id():
        return user_id

    async def _optional_current_user_id():
        return user_id

    if optional:
        app.dependency_overrides[
            __import__("app.api.v1.account_api", fromlist=["optional_current_user_id"]).optional_current_user_id
        ] = _optional_current_user_id
    else:
        app.dependency_overrides[
            __import__("app.api.v1.account_api", fromlist=["current_user_id"]).current_user_id
        ] = _current_user_id


def _clear_overrides():
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Characters endpoints
# ---------------------------------------------------------------------------

class TestCharacterEndpoints:
    def setup_method(self):
        _override_auth(USER_ID)

    def teardown_method(self):
        _clear_overrides()

    @patch("app.service.asset.service.list_characters", new_callable=AsyncMock)
    def test_list_characters_returns_200(self, mock_list):
        from app.schema.asset import CharacterListRead, CharacterSummary
        from datetime import datetime, timezone

        mock_list.return_value = CharacterListRead(
            items=[
                CharacterSummary(
                    id=1, owner_user_id=USER_ID, name="Test",
                    source_type="ai_generated", access_level="free",
                    is_default=False,
                    status="active", created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                )
            ],
            total=1, limit=50, offset=0,
        )
        resp = client.get("/api/v1/assets/characters")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert data["items"][0]["name"] == "Test"

    @patch("app.service.asset.service.get_character", new_callable=AsyncMock)
    def test_get_character_returns_200(self, mock_get):
        mock_get.return_value = _character_payload()
        resp = client.get("/api/v1/assets/characters/1")
        assert resp.status_code == 200

    @patch("app.service.asset.service.create_character", new_callable=AsyncMock)
    def test_create_character_returns_201(self, mock_create):
        mock_create.return_value = _character_payload(id=10, name="New")
        resp = client.post("/api/v1/assets/characters", json={
            "name": "New", "generation_prompt": "test prompt",
            "art_style_id": 1,
        })
        assert resp.status_code == 201

    @patch("app.service.asset.service.create_character", new_callable=AsyncMock)
    def test_create_character_allows_missing_art_style(self, mock_create):
        mock_create.return_value = _character_payload(id=11, name="No Style", art_style_id=None)
        resp = client.post("/api/v1/assets/characters", json={
            "name": "No Style", "generation_prompt": "test",
        })
        assert resp.status_code == 201

    @patch("app.service.storage.service.save_base64_asset", new_callable=AsyncMock)
    def test_upload_character_reference_image_returns_201(self, mock_save):
        mock_save.return_value = {
            "id": 7,
            "storage_key": "asset/character/reference/user/42/test.png",
            "url": "https://cdn.example.com/test.png",
            "mime_type": "image/png",
            "byte_size": 12,
        }
        resp = client.post("/api/v1/assets/characters/image", json={
            "base64": "data:image/png;base64,aGVsbG8=",
            "mime_type": "image/png",
            "filename": "test.png",
        })
        assert resp.status_code == 201
        _, user_id = mock_save.call_args.args[:2]
        assert user_id == USER_ID
        assert mock_save.call_args.kwargs["path_scope"] == "character/reference"

    @patch("app.service.asset.service.update_character", new_callable=AsyncMock)
    def test_update_character_returns_200(self, mock_update):
        mock_update.return_value = _character_payload(name="Updated")
        resp = client.patch("/api/v1/assets/characters/1", json={"name": "Updated"})
        assert resp.status_code == 200

    @patch("app.service.asset.service.delete_character", new_callable=AsyncMock)
    def test_delete_character_returns_204(self, mock_delete):
        mock_delete.return_value = None
        resp = client.delete("/api/v1/assets/characters/1")
        assert resp.status_code == 204

    @patch("app.service.asset.service.set_default_character", new_callable=AsyncMock)
    def test_set_default_character_returns_200(self, mock_set):
        mock_set.return_value = _character_payload(is_default=True)
        resp = client.post("/api/v1/assets/characters/1/default")
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Art Styles endpoints
# ---------------------------------------------------------------------------

class TestArtStyleEndpoints:
    def setup_method(self):
        _override_auth(USER_ID)

    def teardown_method(self):
        _clear_overrides()

    @patch("app.service.asset.service.list_art_styles", new_callable=AsyncMock)
    def test_list_art_styles_returns_200(self, mock_list):
        from app.schema.asset import ArtStyleListRead

        mock_list.return_value = ArtStyleListRead(items=[], total=0, limit=50, offset=0)
        resp = client.get("/api/v1/assets/art-styles")
        assert resp.status_code == 200

    @patch("app.service.asset.service.create_custom_art_style", new_callable=AsyncMock)
    def test_create_custom_art_style_returns_201(self, mock_create):
        mock_create.return_value = _art_style_payload()
        resp = client.post("/api/v1/assets/custom-art-styles", json={
            "name": "My Style", "description": "A custom style",
        })
        assert resp.status_code == 201

    def test_create_custom_art_style_rejects_empty_name(self):
        resp = client.post("/api/v1/assets/custom-art-styles", json={
            "name": "", "description": "desc",
        })
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Voices endpoints
# ---------------------------------------------------------------------------

class TestVoiceEndpoints:
    def setup_method(self):
        _override_auth(USER_ID)

    def teardown_method(self):
        _clear_overrides()

    @patch("app.service.asset.service.list_voices", new_callable=AsyncMock)
    def test_list_voices_returns_200(self, mock_list):
        from app.schema.asset import VoiceListRead

        mock_list.return_value = VoiceListRead(items=[], total=0, limit=50, offset=0)
        resp = client.get("/api/v1/assets/voices")
        assert resp.status_code == 200

    @patch("app.service.asset.service.create_voice", new_callable=AsyncMock)
    def test_create_voice_returns_201(self, mock_create):
        mock_create.return_value = _voice_payload()
        resp = client.post("/api/v1/assets/voices", json={
            "name": "Mom", "source_sample_asset_id": 1, "upload_consent_id": 1,
        })
        assert resp.status_code == 201

    @patch("app.service.asset.service.delete_voice", new_callable=AsyncMock)
    def test_delete_voice_returns_204(self, mock_delete):
        mock_delete.return_value = None
        resp = client.delete("/api/v1/assets/voices/1")
        assert resp.status_code == 204


# ---------------------------------------------------------------------------
# Storage endpoints
# ---------------------------------------------------------------------------

class TestStorageEndpoints:
    def setup_method(self):
        _override_auth(USER_ID)

    def teardown_method(self):
        _clear_overrides()

    @patch("app.service.storage.service.create_upload_session", new_callable=AsyncMock)
    def test_create_upload_session_returns_201(self, mock_create):
        mock_create.return_value = {
            "id": 1, "user_id": USER_ID, "purpose": "voice",
            "filename": "test.wav", "mime_type": "audio/wav",
            "max_byte_size": 52428800, "storage_key": "key",
            "upload_url": "https://oss.example.com/upload",
            "upload_method": "PUT", "upload_headers": {},
            "status": "created", "expires_at": "2026-05-19T12:00:00Z",
            "created_at": "2026-05-19T11:00:00Z", "updated_at": "2026-05-19T11:00:00Z",
        }
        resp = client.post("/api/v1/assets/uploads", json={
            "purpose": "voice", "filename": "test.wav", "mime_type": "audio/wav",
        })
        assert resp.status_code == 201

    @patch("app.service.storage.service.create_upload_session", new_callable=AsyncMock)
    def test_create_upload_session_rejects_character_purpose(self, mock_create):
        resp = client.post("/api/v1/assets/uploads", json={
            "purpose": "character", "filename": "test.jpg", "mime_type": "image/jpeg",
        })
        assert resp.status_code == 400
        mock_create.assert_not_called()

    @patch("app.service.storage.service.complete_upload", new_callable=AsyncMock)
    def test_complete_upload_returns_200(self, mock_complete):
        mock_complete.return_value = {
            "id": 1, "storage_key": "key", "url": "https://cdn.example.com/f.jpg",
            "mime_type": "image/jpeg", "byte_size": 1024,
        }
        resp = client.post("/api/v1/assets/uploads/1/complete", json={
            "visibility": "private",
        })
        assert resp.status_code == 200

    @patch("app.service.storage.service.get_asset_url", new_callable=AsyncMock)
    def test_get_file_url_returns_200(self, mock_url):
        _clear_overrides()
        _override_auth(USER_ID, optional=True)

        mock_url.return_value = "https://cdn.example.com/f.jpg"
        resp = client.get("/api/v1/assets/files/by-asset/1")
        assert resp.status_code == 200
        assert "url" in resp.json()


# ---------------------------------------------------------------------------
# Privacy endpoints
# ---------------------------------------------------------------------------

class TestPrivacyEndpoints:
    def setup_method(self):
        _override_auth(USER_ID)

    def teardown_method(self):
        _clear_overrides()

    @patch("app.service.privacy.service.record_upload_consent", new_callable=AsyncMock)
    def test_record_upload_consent_returns_201(self, mock_record):
        mock_record.return_value = {
            "id": 1, "user_id": USER_ID,
            "target_type": "voice_sample", "target_id": None,
            "consent_text_version": "2026-05-asset-upload",
            "confirmed_rights": True, "confirmed_privacy": True,
            "created_at": "2026-05-19T11:00:00Z",
        }
        resp = client.post("/api/v1/privacy/upload-consents", json={
            "target_type": "voice_sample",
            "confirmed_rights": True, "confirmed_privacy": True,
        })
        assert resp.status_code == 201

    def test_record_upload_consent_rejects_unconfirmed(self):
        resp = client.post("/api/v1/privacy/upload-consents", json={
            "target_type": "voice_sample",
            "confirmed_rights": False, "confirmed_privacy": True,
        })
        assert resp.status_code == 400

    @patch("app.service.privacy.service.record_privacy_confirmation", new_callable=AsyncMock)
    def test_record_privacy_confirmation_returns_201(self, mock_record):
        mock_record.return_value = {
            "id": 1, "user_id": USER_ID, "action": "share",
            "target_type": "book", "target_id": 42,
            "risk_flags": [], "confirmation_text_version": "2026-05-personal-asset-risk",
            "created_at": "2026-05-19T11:00:00Z",
        }
        resp = client.post("/api/v1/privacy/confirmations", json={
            "action": "share",
            "target": {"target_type": "book", "target_id": 42},
        })
        assert resp.status_code == 201

    @patch("app.service.privacy.service.get_privacy_flags", new_callable=AsyncMock)
    def test_get_privacy_flags_returns_200(self, mock_flags):
        mock_flags.return_value = {
            "target_type": "book", "target_id": 42,
            "risk_flags": [], "requires_confirmation": False,
            "latest_confirmation_id": None,
            "visibility": "private", "deletion_policy": "soft_delete",
        }
        resp = client.get("/api/v1/privacy/flags", params={"target_type": "book", "target_id": 42})
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Auth protection
# ---------------------------------------------------------------------------

class TestAuthProtection:
    def teardown_method(self):
        _clear_overrides()

    def test_create_character_requires_auth(self):
        _clear_overrides()
        resp = client.post("/api/v1/assets/characters", json={
            "name": "Test", "generation_prompt": "test", "art_style_id": 1,
        })
        assert resp.status_code == 401

    def test_create_voice_requires_auth(self):
        _clear_overrides()
        resp = client.post("/api/v1/assets/voices", json={
            "name": "Test", "source_sample_asset_id": 1, "upload_consent_id": 1,
        })
        assert resp.status_code == 401

    def test_create_upload_session_requires_auth(self):
        _clear_overrides()
        resp = client.post("/api/v1/assets/uploads", json={
            "purpose": "character", "filename": "test.jpg", "mime_type": "image/jpeg",
        })
        assert resp.status_code == 401

    def test_record_upload_consent_requires_auth(self):
        _clear_overrides()
        resp = client.post("/api/v1/privacy/upload-consents", json={
            "target_type": "voice_sample", "confirmed_rights": True, "confirmed_privacy": True,
        })
        assert resp.status_code == 401
