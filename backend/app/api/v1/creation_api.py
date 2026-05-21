from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.account_api import current_user_id
from app.db.session import get_db
from app.schema.creation import (
    CreationConfigPatch,
    CreationSessionCreate,
    CreationSessionRead,
    CreationTaskResponse,
    GeneratePagesRequest,
    IdeaStoryGenerateRequest,
    RegenerateRequest,
    SaveBookResponse,
    StoryboardPagePatch,
)
from app.service import creation

router = APIRouter()


@router.post("/sessions", response_model=CreationSessionRead, status_code=status.HTTP_201_CREATED)
async def create_session(
    payload: CreationSessionCreate,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> CreationSessionRead:
    return await creation.create_session(db, user_id, payload)


@router.get("/sessions/{session_id}", response_model=CreationSessionRead)
async def get_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> CreationSessionRead:
    return await creation.get_session(db, user_id, session_id)


@router.patch("/sessions/{session_id}/config", response_model=CreationSessionRead)
async def update_session_config(
    session_id: int,
    payload: CreationConfigPatch,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> CreationSessionRead:
    return await creation.update_session_config(db, user_id, session_id, payload)


@router.post("/sessions/{session_id}/generate-story", response_model=CreationTaskResponse)
async def generate_story(
    session_id: int,
    payload: IdeaStoryGenerateRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> CreationTaskResponse:
    return await creation.generate_story(db, user_id, session_id, payload)


@router.post("/sessions/{session_id}/generate-storyboard", response_model=CreationTaskResponse)
async def generate_storyboard(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> CreationTaskResponse:
    return await creation.generate_storyboard(db, user_id, session_id)


@router.patch("/sessions/{session_id}/storyboard/pages/{page_id}", response_model=CreationSessionRead)
async def update_storyboard_page(
    session_id: int,
    page_id: int,
    payload: StoryboardPagePatch,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> CreationSessionRead:
    return await creation.update_storyboard_page(db, user_id, session_id, page_id, payload)


@router.post("/sessions/{session_id}/generate-images", response_model=CreationTaskResponse)
async def generate_images(
    session_id: int,
    payload: GeneratePagesRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> CreationTaskResponse:
    return await creation.generate_images(db, user_id, session_id, payload)


@router.post("/sessions/{session_id}/generate-audio", response_model=CreationTaskResponse)
async def generate_audio(
    session_id: int,
    payload: GeneratePagesRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> CreationTaskResponse:
    return await creation.generate_audio(db, user_id, session_id, payload)


@router.post("/sessions/{session_id}/generate-lip-sync", response_model=CreationTaskResponse)
async def generate_lip_sync(
    session_id: int,
    payload: GeneratePagesRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> CreationTaskResponse:
    return await creation.generate_lip_sync(db, user_id, session_id, payload)


@router.post("/sessions/{session_id}/regenerate", response_model=CreationTaskResponse)
async def regenerate(
    session_id: int,
    payload: RegenerateRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> CreationTaskResponse:
    return await creation.regenerate(db, user_id, session_id, payload)


@router.post("/sessions/{session_id}/save-book", response_model=SaveBookResponse)
async def save_book(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> SaveBookResponse:
    return await creation.save_book(db, user_id, session_id)
