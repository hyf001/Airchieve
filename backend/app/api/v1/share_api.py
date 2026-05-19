from fastapi import APIRouter, Depends, Header, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.account_api import current_user_id
from app.db.session import get_db
from app.model.book import BookLanguage
from app.schema.book import BookPlayerOptions
from app.schema.share import PublicShareRead, ShareLinkCreate, ShareLinkListRead, ShareLinkRead, ShareLinkUpdate, SharedPlayerPayload
from app.service import share as share_service

router = APIRouter()


@router.post("/book/{book_id}", response_model=ShareLinkRead, status_code=status.HTTP_201_CREATED)
async def create_share_link(
    book_id: int,
    payload: ShareLinkCreate,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> ShareLinkRead:
    return await share_service.create_share_link(db, user_id, book_id, payload)


@router.get("/links", response_model=ShareLinkListRead)
async def list_share_links(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> ShareLinkListRead:
    return await share_service.list_user_share_links(db, user_id, limit=limit, offset=offset)


@router.patch("/links/{share_id}", response_model=ShareLinkRead)
async def update_share_link(
    share_id: int,
    payload: ShareLinkUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> ShareLinkRead:
    return await share_service.update_share_link(db, user_id, share_id, payload)


@router.post("/links/{share_id}/close", response_model=ShareLinkRead)
async def close_share_link(
    share_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> ShareLinkRead:
    return await share_service.close_share_link(db, user_id, share_id)


@router.post("/links/{share_id}/regenerate-token", response_model=ShareLinkRead)
async def regenerate_share_token(
    share_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> ShareLinkRead:
    return await share_service.regenerate_share_token(db, user_id, share_id)


@router.get("/public/{token}", response_model=PublicShareRead)
async def get_public_share(
    token: str,
    password: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> PublicShareRead:
    return await share_service.get_share_link(db, token, password=password)


@router.get("/public/{token}/player", response_model=SharedPlayerPayload)
async def get_public_share_player(
    token: str,
    text_mode: BookLanguage | None = None,
    voice_id: int | None = None,
    password: str | None = None,
    db: AsyncSession = Depends(get_db),
    visitor_id: str | None = Header(default=None, alias="X-Visitor-ID"),
    user_agent: str | None = Header(default=None),
) -> SharedPlayerPayload:
    return await share_service.get_shared_player_payload(
        db,
        token,
        options=BookPlayerOptions(text_mode=text_mode, voice_id=voice_id),
        visitor_id=visitor_id,
        user_agent=user_agent,
        password=password,
    )
