from collections.abc import Awaitable, Callable

from sqlalchemy.ext.asyncio import AsyncSession

from app.model.generation_task import GenerationTask, GenerationTaskType
from app.service.asset.character_generation import run_character_image_task
from app.service.creation.service import (
    run_creation_audio_task,
    run_creation_image_task,
    run_creation_lip_sync_task,
    run_story_task,
    run_storyboard_task,
)
from app.service.export.service import run_pdf_export_task
from app.service.template.service import run_template_composite_task

GenerationTaskHandler = Callable[[AsyncSession, GenerationTask], Awaitable[None]]

GENERATION_TASK_HANDLERS: dict[GenerationTaskType, GenerationTaskHandler] = {
    GenerationTaskType.CHARACTER_IMAGE: run_character_image_task,
    GenerationTaskType.STORY: run_story_task,
    GenerationTaskType.STORYBOARD: run_storyboard_task,
    GenerationTaskType.IMAGE: run_creation_image_task,
    GenerationTaskType.AUDIO: run_creation_audio_task,
    GenerationTaskType.LIP_SYNC: run_creation_lip_sync_task,
    GenerationTaskType.TEMPLATE_COMPOSITE: run_template_composite_task,
    GenerationTaskType.PDF_EXPORT: run_pdf_export_task,
}


def supported_generation_task_types() -> set[GenerationTaskType]:
    return set(GENERATION_TASK_HANDLERS)


async def dispatch_generation_task(db: AsyncSession, task: GenerationTask) -> None:
    handler = GENERATION_TASK_HANDLERS.get(task.task_type)
    if handler is None:
        raise ValueError(f"Unsupported generation task type: {task.task_type}")
    await handler(db, task)
