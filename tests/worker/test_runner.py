import asyncio
from contextlib import asynccontextmanager

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.model.generation_task import GenerationTask, GenerationTaskStatus, GenerationTaskType
from app.worker import runner


async def test_run_once_marks_claimed_task_failed_when_cancelled(db: AsyncSession, engine, monkeypatch):
    task = GenerationTask(
        task_type=GenerationTaskType.STORY,
        owner_type="creation",
        owner_id=1,
        status=GenerationTaskStatus.QUEUED,
        input_payload={},
    )
    db.add(task)
    await db.commit()
    task_id = task.id

    session_maker = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    @asynccontextmanager
    async def session_factory():
        async with session_maker() as session:
            yield session

    async def dispatch_raises_cancelled(_db, _task):
        raise asyncio.CancelledError()

    monkeypatch.setattr(runner, "async_session_maker", session_factory)
    monkeypatch.setattr(runner.generation_task_worker, "dispatch", dispatch_raises_cancelled)

    with pytest.raises(asyncio.CancelledError):
        await runner.run_once()

    db.expire_all()
    refreshed = await db.get(GenerationTask, task_id)
    assert refreshed.status == GenerationTaskStatus.FAILED
    assert refreshed.error_code == "CancelledError"
    assert refreshed.finished_at is not None
