from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.model.generation_task import (
    GenerationAttemptStatus,
    GenerationTask,
    GenerationTaskAttempt,
    GenerationTaskStatus,
    GenerationTaskType,
)
from app.schema.generation_task import GenerationTaskCreate, GenerationTaskListRead, GenerationTaskRead


def _task_read(task: GenerationTask) -> GenerationTaskRead:
    return GenerationTaskRead(
        id=task.id,
        task_type=task.task_type,
        owner_type=task.owner_type,
        owner_id=task.owner_id,
        user_id=task.user_id,
        status=task.status,
        progress_percent=task.progress_percent,
        result_refs=task.output_payload,
        error_code=task.error_code,
        error_message=task.error_message,
        retryable=task.status == GenerationTaskStatus.FAILED and task.retry_count < 3,
        retry_count=task.retry_count,
        provider=task.provider,
        started_at=task.started_at,
        finished_at=task.finished_at,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


async def create_task(db: AsyncSession, payload: GenerationTaskCreate) -> GenerationTaskRead:
    task = GenerationTask(
        task_type=payload.task_type,
        owner_type=payload.owner_type,
        owner_id=payload.owner_id,
        user_id=payload.user_id,
        input_payload=payload.input_payload,
        provider=payload.provider,
    )
    db.add(task)
    await db.flush()
    return _task_read(task)


async def mark_task_running(db: AsyncSession, task_id: int) -> GenerationTask:
    task = await _get_task_model(db, task_id)
    now = datetime.now(timezone.utc)
    task.status = GenerationTaskStatus.RUNNING
    task.progress_percent = max(task.progress_percent, 10)
    task.started_at = task.started_at or now
    attempt = GenerationTaskAttempt(
        task_id=task.id,
        attempt_no=task.retry_count + 1,
        status=GenerationAttemptStatus.RUNNING,
        started_at=now,
    )
    db.add(attempt)
    await db.flush()
    return task


async def mark_task_succeeded(db: AsyncSession, task_id: int, *, result_refs: dict | None = None) -> GenerationTaskRead:
    task = await _get_task_model(db, task_id)
    now = datetime.now(timezone.utc)
    task.status = GenerationTaskStatus.SUCCEEDED
    task.progress_percent = 100
    task.output_payload = result_refs or {}
    task.error_code = None
    task.error_message = None
    task.finished_at = now
    await _finish_latest_attempt(db, task.id, GenerationAttemptStatus.SUCCEEDED, now)
    await db.flush()
    return _task_read(task)


async def mark_task_failed(
    db: AsyncSession,
    task_id: int,
    *,
    error_code: str,
    error_message: str,
) -> GenerationTaskRead:
    task = await _get_task_model(db, task_id)
    now = datetime.now(timezone.utc)
    task.status = GenerationTaskStatus.FAILED
    task.error_code = error_code
    task.error_message = error_message
    task.finished_at = now
    await _finish_latest_attempt(db, task.id, GenerationAttemptStatus.FAILED, now)
    await db.flush()
    return _task_read(task)


async def get_task(db: AsyncSession, task_id: int, *, user_id: int | None = None) -> GenerationTaskRead:
    task = await _get_task_model(db, task_id)
    if user_id is not None and task.user_id is not None and task.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="任务不存在")
    return _task_read(task)


async def list_tasks(
    db: AsyncSession,
    *,
    user_id: int | None = None,
    task_type: GenerationTaskType | None = None,
    status_filter: GenerationTaskStatus | None = None,
    limit: int = 20,
    offset: int = 0,
) -> GenerationTaskListRead:
    conditions = []
    if user_id is not None:
        conditions.append(GenerationTask.user_id == user_id)
    if task_type is not None:
        conditions.append(GenerationTask.task_type == task_type)
    if status_filter is not None:
        conditions.append(GenerationTask.status == status_filter)
    stmt = select(GenerationTask).where(*conditions).order_by(GenerationTask.created_at.desc())
    result = await db.execute(stmt.offset(offset).limit(limit))
    total = await db.scalar(select(func.count()).select_from(GenerationTask).where(*conditions))
    return GenerationTaskListRead(
        items=[_task_read(task) for task in result.scalars().all()],
        total=total or 0,
        limit=limit,
        offset=offset,
    )


async def retry_task(db: AsyncSession, task_id: int, *, user_id: int | None = None) -> GenerationTaskRead:
    task = await _get_task_model(db, task_id)
    if user_id is not None and task.user_id is not None and task.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="任务不存在")
    if task.status != GenerationTaskStatus.FAILED or task.retry_count >= 3:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="TASK_NOT_RETRYABLE")
    task.status = GenerationTaskStatus.QUEUED
    task.progress_percent = 0
    task.retry_count += 1
    task.output_payload = None
    task.error_code = None
    task.error_message = None
    task.finished_at = None
    await db.commit()
    await db.refresh(task)
    return _task_read(task)


async def _get_task_model(db: AsyncSession, task_id: int) -> GenerationTask:
    task = await db.get(GenerationTask, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="任务不存在")
    return task


async def _finish_latest_attempt(
    db: AsyncSession,
    task_id: int,
    status_value: GenerationAttemptStatus,
    finished_at: datetime,
) -> None:
    result = await db.execute(
        select(GenerationTaskAttempt)
        .where(GenerationTaskAttempt.task_id == task_id)
        .order_by(GenerationTaskAttempt.attempt_no.desc())
        .limit(1)
    )
    attempt = result.scalar_one_or_none()
    if attempt is not None:
        attempt.status = status_value
        attempt.finished_at = finished_at
