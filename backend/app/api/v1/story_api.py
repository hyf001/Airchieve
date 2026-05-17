from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.account_api import current_user_id
from app.db.session import get_db
from app.model.story import StorySourceType
from app.schema.story import (
    StartCreationFromStoryRequest,
    StoryCreate,
    StoryCreationSessionRead,
    StoryListRead,
    StoryRead,
    StoryUpdate,
)
from app.service import story

router = APIRouter()


@router.get("", response_model=StoryListRead)
async def list_stories(
    source_type: StorySourceType | None = None,
    q: str | None = None,
    theme_id: int | None = None,
    age_range_id: int | None = None,
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> StoryListRead:
    return await story.list_stories(
        db,
        source_type=source_type,
        q=q,
        theme_id=theme_id,
        age_range_id=age_range_id,
        limit=limit,
        offset=offset,
    )


@router.get("/{story_id}", response_model=StoryRead)
async def get_story(story_id: int, db: AsyncSession = Depends(get_db)) -> StoryRead:
    return await story.get_story(db, story_id)


@router.post("", response_model=StoryRead, status_code=status.HTTP_201_CREATED)
async def create_story(
    payload: StoryCreate,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> StoryRead:
    return await story.create_user_story(db, user_id, payload)


@router.patch("/{story_id}", response_model=StoryRead)
async def update_story(
    story_id: int,
    payload: StoryUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> StoryRead:
    return await story.update_user_story(db, user_id, story_id, payload)


@router.delete("/{story_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_story(
    story_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> Response:
    await story.delete_user_story(db, user_id, story_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{story_id}/start-creation", response_model=StoryCreationSessionRead)
async def start_creation_from_story(
    story_id: int,
    payload: StartCreationFromStoryRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> StoryCreationSessionRead:
    return await story.start_creation_from_story(db, user_id=user_id, story_id=story_id, payload=payload)
