from sqlalchemy.ext.asyncio import AsyncSession

from app.model.generation_task import GenerationTask, GenerationTaskType
from app.service import generation_task as generation_task_service
from app.worker.registry import dispatch_generation_task, supported_generation_task_types


def default_task_types() -> set[GenerationTaskType]:
    return supported_generation_task_types()


async def claim_next(db: AsyncSession, *, task_types: set[GenerationTaskType] | None = None) -> GenerationTask | None:
    return await generation_task_service.claim_next_task(db, task_types=task_types or default_task_types())


async def dispatch(db: AsyncSession, task: GenerationTask) -> None:
    await dispatch_generation_task(db, task)


async def mark_failed(db: AsyncSession, task: GenerationTask, exc: BaseException) -> None:
    await _mark_owner_failed(db, task, exc)
    error_code = getattr(exc, "error_code", exc.__class__.__name__)
    await generation_task_service.mark_task_failed(
        db,
        task.id,
        error_code=str(error_code)[:80],
        error_message=(str(exc) or exc.__class__.__name__)[:500],
    )


async def _mark_owner_failed(db: AsyncSession, task: GenerationTask, exc: BaseException) -> None:
    if task.owner_type == "creation":
        from app.service.creation.service import mark_task_owner_failed

        await mark_task_owner_failed(db, task, exc)
    elif task.owner_type == "template":
        from app.service.template.service import mark_template_task_failed

        await mark_template_task_failed(db, task, exc)
    elif task.owner_type == "export_job":
        from app.service.export.service import mark_pdf_export_task_failed

        await mark_pdf_export_task_failed(db, task, exc)
