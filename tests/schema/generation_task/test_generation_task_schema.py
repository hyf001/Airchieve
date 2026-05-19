from datetime import datetime, timezone

import pytest

from app.model.generation_task import (
    GenerationTask,
    GenerationTaskStatus,
    GenerationTaskType,
)
from app.schema.generation_task import GenerationErrorCode, GenerationTaskRead


class TestGenerationErrorCode:
    def test_all_error_codes_defined(self):
        expected = {
            "STORY_TEXT_TOO_LONG",
            "PAGE_COUNT_OUT_OF_RANGE",
            "ASSET_NOT_USABLE",
            "ENTITLEMENT_REQUIRED",
            "QUOTA_NOT_ENOUGH",
            "TEMPLATE_CONTENT_LOCKED",
            "REFERENCE_COPY_FORBIDDEN",
            "PROVIDER_TIMEOUT",
            "PROVIDER_RATE_LIMITED",
            "PROVIDER_FAILED",
            "TASK_NOT_RETRYABLE",
        }
        actual = {e.value for e in GenerationErrorCode}
        assert actual == expected


class TestGenerationTaskRead:
    """Test that GenerationTaskRead can be constructed from ORM model via from_attributes."""

    def _make_orm_task(self, **overrides):
        defaults = {
            "id": 1,
            "task_type": GenerationTaskType.STORY,
            "owner_type": "creation",
            "owner_id": 10,
            "user_id": 100,
            "status": GenerationTaskStatus.SUCCEEDED,
            "progress_percent": 100,
            "input_payload": {"prompt": "test"},
            "output_payload": {"story_preview": "result text"},
            "provider": "mock",
            "error_code": None,
            "error_message": None,
            "retry_count": 0,
        }
        defaults.update(overrides)
        task = GenerationTask(**defaults)
        task.created_at = datetime.now(timezone.utc)
        task.updated_at = datetime.now(timezone.utc)
        return task

    def test_from_attributes_maps_result_refs(self):
        task = self._make_orm_task(output_payload={"url": "s3://x"})
        read = GenerationTaskRead.model_validate(task)
        assert read.result_refs == {"url": "s3://x"}

    def test_from_attributes_maps_retryable_failed(self):
        task = self._make_orm_task(status=GenerationTaskStatus.FAILED, retry_count=0)
        read = GenerationTaskRead.model_validate(task)
        assert read.retryable is True

    def test_from_attributes_maps_retryable_succeeded(self):
        task = self._make_orm_task(status=GenerationTaskStatus.SUCCEEDED)
        read = GenerationTaskRead.model_validate(task)
        assert read.retryable is False

    def test_from_attributes_maps_all_fields(self):
        now = datetime.now(timezone.utc)
        task = self._make_orm_task(started_at=now, finished_at=now)
        read = GenerationTaskRead.model_validate(task)
        assert read.id == 1
        assert read.task_type == GenerationTaskType.STORY
        assert read.owner_type == "creation"
        assert read.owner_id == 10
        assert read.user_id == 100
        assert read.status == GenerationTaskStatus.SUCCEEDED
        assert read.progress_percent == 100
        assert read.provider == "mock"
        assert read.retry_count == 0
        assert read.started_at is not None
        assert read.finished_at is not None

    def test_from_attributes_null_output_payload(self):
        task = self._make_orm_task(output_payload=None)
        read = GenerationTaskRead.model_validate(task)
        assert read.result_refs is None

    def test_from_attributes_null_user_id(self):
        task = self._make_orm_task(user_id=None)
        read = GenerationTaskRead.model_validate(task)
        assert read.user_id is None
