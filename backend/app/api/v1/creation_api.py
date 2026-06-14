from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.account_api import current_user_id
from app.db.session import get_db
from app.schema.creation import (
    CreationConfigPatch,
    CreationSessionCreate,
    CreationSessionRead,
    CreationTaskResponse,
    GenerateImagesRequest,
    GeneratePageImageRequest,
    GeneratePagesRequest,
    IdeaStoryGenerateRequest,
    PageDraftPatch,
    RegenerateRequest,
    SaveBookResponse,
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


@router.get("/sessions", response_model=list[CreationSessionRead])
async def list_sessions(
    child_profile_id: int | None = None,
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> list[CreationSessionRead]:
    return await creation.list_sessions(
        db,
        user_id,
        child_profile_id=child_profile_id,
        limit=limit,
        offset=offset,
    )


@router.get("/sessions/{session_id}", response_model=CreationSessionRead)
async def get_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> CreationSessionRead:
    return await creation.get_session(db, user_id, session_id)


@router.post("/sessions/{session_id}/duplicate", response_model=CreationSessionRead, status_code=status.HTTP_201_CREATED)
async def duplicate_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> CreationSessionRead:
    return await creation.duplicate_session(db, user_id, session_id)


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


@router.patch("/sessions/{session_id}/page-drafts/{page_id}", response_model=CreationSessionRead)
async def update_page_draft(
    session_id: int,
    page_id: int,
    payload: PageDraftPatch,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> CreationSessionRead:
    return await creation.update_page_draft(db, user_id, session_id, page_id, payload)


@router.post("/sessions/{session_id}/generate-images", response_model=CreationTaskResponse)
async def generate_images(
    session_id: int,
    payload: GenerateImagesRequest | None = None,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> CreationTaskResponse:
    return await creation.generate_images(db, user_id, session_id, payload or GenerateImagesRequest())


@router.post("/sessions/{session_id}/page-drafts/{page_id}/generate-image", response_model=CreationTaskResponse)
async def generate_page_image(
    session_id: int,
    page_id: int,
    payload: GeneratePageImageRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> CreationTaskResponse:
    return await creation.generate_page_image(db, user_id, session_id, page_id, payload)


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
