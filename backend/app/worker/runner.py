import asyncio
import time
from collections.abc import Iterable

from app.core.config import settings
from app.core.utils.logger import get_logger
from app.db.session import async_session_maker
from app.model.generation_task import GenerationTask, GenerationTaskType
from app.worker import generation_task as generation_task_worker

logger = get_logger(__name__)


async def _mark_task_failed_after_exception(task_id: int, exc: BaseException, started_at: float) -> None:
    async with async_session_maker() as db:
        failed_task = await db.get(GenerationTask, task_id)
        if failed_task is not None:
            await generation_task_worker.mark_failed(db, failed_task, exc)
            await db.commit()
            elapsed_seconds = time.perf_counter() - started_at
            logger.exception(
                "generation task finished: task_id=%s task_type=%s status=failed elapsed_seconds=%.3f",
                failed_task.id,
                failed_task.task_type.value,
                elapsed_seconds,
            )


def parse_generation_task_types(values: Iterable[str] | None) -> set[GenerationTaskType] | None:
    if values is None:
        return None
    return {GenerationTaskType(value) for value in values}


def _format_task_types(task_types: set[GenerationTaskType] | None) -> str:
    if task_types is None:
        return "default"
    return ",".join(sorted(task_type.value for task_type in task_types))


async def run_once(*, task_types: set[GenerationTaskType] | None = None) -> bool:
    async with async_session_maker() as db:
        task = await generation_task_worker.claim_next(db, task_types=task_types)
        if task is None:
            await db.rollback()
            return False
        await db.commit()

    task_id = task.id
    started_at = time.perf_counter()
    logger.info(
        "generation task started: task_id=%s task_type=%s owner_type=%s owner_id=%s user_id=%s",
        task_id,
        task.task_type.value,
        task.owner_type,
        task.owner_id,
        task.user_id,
    )

    try:
        async with async_session_maker() as db:
            task = await db.get(GenerationTask, task_id)
            if task is None:
                elapsed_seconds = time.perf_counter() - started_at
                logger.warning(
                    "generation task finished: task_id=%s status=missing elapsed_seconds=%.3f",
                    task_id,
                    elapsed_seconds,
                )
                return False
            await generation_task_worker.dispatch(db, task)
            await db.commit()
            elapsed_seconds = time.perf_counter() - started_at
            logger.info(
                "generation task finished: task_id=%s task_type=%s status=succeeded elapsed_seconds=%.3f",
                task.id,
                task.task_type.value,
                elapsed_seconds,
            )
    except asyncio.CancelledError as exc:
        await _mark_task_failed_after_exception(task_id, exc, started_at)
        raise
    except Exception as exc:
        await _mark_task_failed_after_exception(task_id, exc, started_at)
    return True


async def run_worker(
    *,
    task_types: set[GenerationTaskType] | None = None,
    poll_interval_seconds: float | None = None,
    stop_event: asyncio.Event | None = None,
) -> None:
    interval = settings.WORKER_POLL_INTERVAL_SECONDS if poll_interval_seconds is None else poll_interval_seconds
    logger.info(
        "worker started: task_source=generation_task task_types=%s poll_interval_seconds=%s",
        _format_task_types(task_types),
        interval,
    )
    # TODO(worker-concurrency): Add WORKER_CONCURRENCY and run multiple consumer
    # loops in this process when claim_next_task is atomic on every supported DB.
    # Until then, one worker loop intentionally processes one task at a time.
    while stop_event is None or not stop_event.is_set():
        processed = await run_once(task_types=task_types)
        if not processed:
            try:
                await asyncio.wait_for((stop_event or asyncio.Event()).wait(), timeout=interval)
            except TimeoutError:
                pass
