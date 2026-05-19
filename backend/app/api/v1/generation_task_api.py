from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.account_api import current_user_id
from app.db.session import get_db
from app.model.generation_task import GenerationTaskStatus, GenerationTaskType
from app.schema.generation_task import GenerationTaskListRead, GenerationTaskRead
from app.service import generation_task

router = APIRouter()


@router.get("", response_model=GenerationTaskListRead)
async def list_generation_tasks(
    task_type: GenerationTaskType | None = None,
    status_filter: GenerationTaskStatus | None = None,
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> GenerationTaskListRead:
    return await generation_task.list_tasks(
        db,
        user_id=user_id,
        task_type=task_type,
        status_filter=status_filter,
        limit=limit,
        offset=offset,
    )


@router.get("/{task_id}", response_model=GenerationTaskRead)
async def get_generation_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> GenerationTaskRead:
    return await generation_task.get_task(db, task_id, user_id=user_id)


@router.post("/{task_id}/retry", response_model=GenerationTaskRead)
async def retry_generation_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> GenerationTaskRead:
    return await generation_task.retry_task(db, task_id, user_id=user_id)
