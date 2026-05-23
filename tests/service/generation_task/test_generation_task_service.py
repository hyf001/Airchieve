from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.model.generation_task import GenerationTaskStatus, GenerationTaskType
from app.schema.generation_task import GenerationTaskCreate
from app.service.generation_task import (
    claim_next_task,
    create_task,
    get_task,
    mark_task_failed,
    mark_task_running,
    mark_task_succeeded,
    retry_task,
)


class TestCreateTask:
    async def test_create_task_returns_read(self, db: AsyncSession):
        payload = GenerationTaskCreate(
            task_type=GenerationTaskType.STORY,
            owner_type="creation",
            owner_id=1,
            user_id=100,
            input_payload={"prompt": "hello"},
        )
        result = await create_task(db, payload)
        assert result.id is not None
        assert result.task_type == GenerationTaskType.STORY
        assert result.owner_type == "creation"
        assert result.owner_id == 1
        assert result.user_id == 100
        assert result.status == GenerationTaskStatus.QUEUED
        assert result.progress_percent == 0
        assert result.retry_count == 0


class TestMarkTaskRunning:
    async def test_mark_running_updates_status(self, db: AsyncSession):
        payload = GenerationTaskCreate(
            task_type=GenerationTaskType.IMAGE,
            owner_type="creation",
            owner_id=1,
        )
        task = await create_task(db, payload)
        updated = await mark_task_running(db, task.id)
        assert updated.status == GenerationTaskStatus.RUNNING
        assert updated.progress_percent >= 10
        assert updated.started_at is not None


class TestClaimNextTask:
    async def test_claim_next_task_marks_running(self, db: AsyncSession):
        payload = GenerationTaskCreate(
            task_type=GenerationTaskType.CHARACTER_IMAGE,
            owner_type="character",
            owner_id=1,
            user_id=10,
        )
        created = await create_task(db, payload)
        claimed = await claim_next_task(db, task_types={GenerationTaskType.CHARACTER_IMAGE})
        assert claimed is not None
        assert claimed.id == created.id
        assert claimed.status == GenerationTaskStatus.RUNNING
        assert claimed.progress_percent >= 10
        assert claimed.started_at is not None

    async def test_claim_next_task_filters_task_type(self, db: AsyncSession):
        await create_task(
            db,
            GenerationTaskCreate(
                task_type=GenerationTaskType.STORY,
                owner_type="creation",
                owner_id=1,
            ),
        )
        claimed = await claim_next_task(db, task_types={GenerationTaskType.CHARACTER_IMAGE})
        assert claimed is None


class TestMarkTaskSucceeded:
    async def test_mark_succeeded(self, db: AsyncSession):
        payload = GenerationTaskCreate(
            task_type=GenerationTaskType.AUDIO,
            owner_type="creation",
            owner_id=1,
        )
        task = await create_task(db, payload)
        await mark_task_running(db, task.id)
        result = await mark_task_succeeded(db, task.id, result_refs={"asset_ids": [1, 2, 3]})
        assert result.status == GenerationTaskStatus.SUCCEEDED
        assert result.progress_percent == 100
        assert result.result_refs == {"asset_ids": [1, 2, 3]}
        assert result.finished_at is not None
        assert result.error_code is None


class TestMarkTaskFailed:
    async def test_mark_failed(self, db: AsyncSession):
        payload = GenerationTaskCreate(
            task_type=GenerationTaskType.STORYBOARD,
            owner_type="creation",
            owner_id=1,
        )
        task = await create_task(db, payload)
        await mark_task_running(db, task.id)
        result = await mark_task_failed(
            db,
            task.id,
            error_code="PROVIDER_FAILED",
            error_message="Connection timeout",
        )
        assert result.status == GenerationTaskStatus.FAILED
        assert result.error_code == "PROVIDER_FAILED"
        assert result.error_message == "Connection timeout"
        assert result.finished_at is not None


class TestRetryTask:
    async def test_retry_resets_status(self, db: AsyncSession):
        payload = GenerationTaskCreate(
            task_type=GenerationTaskType.IMAGE,
            owner_type="creation",
            owner_id=1,
            user_id=50,
        )
        task = await create_task(db, payload)
        await mark_task_running(db, task.id)
        await mark_task_failed(db, task.id, error_code="PROVIDER_FAILED", error_message="err")
        result = await retry_task(db, task.id, user_id=50)
        assert result.status == GenerationTaskStatus.QUEUED
        assert result.retry_count == 1
        assert result.result_refs is None
        assert result.error_code is None

    async def test_retry_non_failed_raises(self, db: AsyncSession):
        payload = GenerationTaskCreate(
            task_type=GenerationTaskType.IMAGE,
            owner_type="creation",
            owner_id=1,
        )
        task = await create_task(db, payload)
        with pytest.raises(HTTPException) as exc_info:
            await retry_task(db, task.id)
        assert exc_info.value.status_code == 400
        assert "TASK_NOT_RETRYABLE" in exc_info.value.detail

    async def test_retry_exceeds_max_retries(self, db: AsyncSession):
        payload = GenerationTaskCreate(
            task_type=GenerationTaskType.IMAGE,
            owner_type="creation",
            owner_id=1,
        )
        task = await create_task(db, payload)
        # Fail -> retry 3 times, each retry increments retry_count
        for _ in range(3):
            await mark_task_running(db, task.id)
            await mark_task_failed(db, task.id, error_code="PROVIDER_FAILED", error_message="err")
            try:
                await retry_task(db, task.id)
            except HTTPException:
                pass  # 3rd retry may fail, that's what we test below
        # After 3 retries the task should have retry_count >= 3 and status FAILED
        # Need to fail the last retry to get status=FAILED
        await mark_task_running(db, task.id)
        await mark_task_failed(db, task.id, error_code="PROVIDER_FAILED", error_message="err")
        with pytest.raises(HTTPException) as exc_info:
            await retry_task(db, task.id)
        assert "TASK_NOT_RETRYABLE" in exc_info.value.detail


class TestGetTask:
    async def test_get_existing_task(self, db: AsyncSession):
        payload = GenerationTaskCreate(
            task_type=GenerationTaskType.STORY,
            owner_type="creation",
            owner_id=1,
            user_id=100,
        )
        task = await create_task(db, payload)
        result = await get_task(db, task.id)
        assert result.id == task.id

    async def test_get_nonexistent_task_raises(self, db: AsyncSession):
        with pytest.raises(HTTPException) as exc_info:
            await get_task(db, 99999)
        assert exc_info.value.status_code == 404

    async def test_get_task_user_mismatch_raises(self, db: AsyncSession):
        payload = GenerationTaskCreate(
            task_type=GenerationTaskType.STORY,
            owner_type="creation",
            owner_id=1,
            user_id=100,
        )
        task = await create_task(db, payload)
        with pytest.raises(HTTPException):
            await get_task(db, task.id, user_id=200)
