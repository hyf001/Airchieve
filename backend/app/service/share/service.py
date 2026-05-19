import hashlib
import secrets
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.model.book import Book, BookPublishStatus
from app.model.privacy import PrivacyAction, PrivacyVisibility
from app.model.share import ShareAccessLog, ShareAccessScope, ShareLink, ShareLinkStatus
from app.schema.book import BookPlayerOptions
from app.schema.entitlement import EntitlementQuotaKey
from app.schema.privacy import PrivacyTarget
from app.schema.share import PublicShareRead, ShareLinkCreate, ShareLinkListRead, ShareLinkRead, ShareLinkUpdate, SharedPlayerPayload
from app.service import entitlement as entitlement_service
from app.service.book import book_service
from app.service.privacy import service as privacy_service


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _new_token() -> str:
    return secrets.token_urlsafe(24)


def _is_active(link: ShareLink) -> bool:
    return link.status == ShareLinkStatus.ACTIVE and (link.expires_at is None or link.expires_at > _now())


async def _assert_book_shareable(db: AsyncSession, user_id: int, book_id: int) -> Book:
    book = await db.get(Book, book_id)
    if book is None or book.publish_status != BookPublishStatus.PUBLISHED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="绘本不存在")
    if book.owner_user_id is not None and book.owner_user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="绘本不存在")
    return book


async def _access_count(db: AsyncSession, share_id: int) -> int:
    return await db.scalar(select(func.count()).select_from(ShareAccessLog).where(ShareAccessLog.share_id == share_id)) or 0


async def _read_link(db: AsyncSession, link: ShareLink, *, token: str | None = None) -> ShareLinkRead:
    return ShareLinkRead(
        id=link.id,
        user_id=link.user_id,
        book_id=link.book_id,
        title_snapshot=link.title_snapshot,
        cover_url_snapshot=link.cover_url_snapshot,
        access_scope=link.access_scope,
        status=link.status,
        privacy_confirmation_id=link.privacy_confirmation_id,
        expires_at=link.expires_at,
        created_at=link.created_at,
        updated_at=link.updated_at,
        token=token,
        public_url=f"/share/public/{token}" if token else None,
        access_count=await _access_count(db, link.id),
    )


async def _find_user_link(db: AsyncSession, user_id: int, share_id: int) -> ShareLink:
    link = await db.get(ShareLink, share_id)
    if link is None or link.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="分享链接不存在")
    return link


async def _find_public_link(db: AsyncSession, token: str, *, password: str | None = None) -> ShareLink:
    result = await db.execute(select(ShareLink).where(ShareLink.token_hash == _hash(token)))
    link = result.scalar_one_or_none()
    if link is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="分享链接不存在")
    if link.status == ShareLinkStatus.BANNED:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="分享链接已被封禁")
    if not _is_active(link):
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="分享链接已关闭或过期")
    if link.access_scope == ShareAccessScope.PASSWORD and (password is None or link.password_hash != _hash(password)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="分享链接需要访问密码")
    if link.access_scope == ShareAccessScope.SPECIFIED:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="指定访问范围暂未开放")
    return link


async def create_share_link(db: AsyncSession, user_id: int, book_id: int, payload: ShareLinkCreate) -> ShareLinkRead:
    book = await _assert_book_shareable(db, user_id, book_id)
    if payload.idempotency_key:
        existing = await db.execute(
            select(ShareLink).where(
                ShareLink.user_id == user_id,
                ShareLink.idempotency_key == payload.idempotency_key,
            )
        )
        existing_link = existing.scalar_one_or_none()
        if existing_link is not None:
            return await _read_link(db, existing_link)
    if payload.access_scope == ShareAccessScope.SPECIFIED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="指定访问范围暂未开放")
    if payload.access_scope == ShareAccessScope.PASSWORD and not payload.password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="密码分享必须设置访问密码")
    target = PrivacyTarget(target_type="book", target_id=book_id)
    flags = await privacy_service.get_privacy_flags(db, target, user_id=user_id, action=PrivacyAction.SHARE)
    if flags.requires_confirmation:
        await privacy_service.assert_privacy_confirmation(
            db,
            user_id=user_id,
            confirmation_id=payload.privacy_confirmation_id,
            action=PrivacyAction.SHARE,
            target=target,
        )
    await entitlement_service.consume_quota(
        db,
        user_id,
        EntitlementQuotaKey.SHARE_MONTHLY,
        idempotency_key=payload.idempotency_key,
    )
    token = _new_token()
    link = ShareLink(
        user_id=user_id,
        book_id=book.id,
        token_hash=_hash(token),
        title_snapshot=book.title,
        cover_asset_id_snapshot=book.cover_asset_id,
        cover_url_snapshot=book.cover_url,
        access_scope=payload.access_scope,
        password_hash=_hash(payload.password) if payload.password else None,
        idempotency_key=payload.idempotency_key,
        status=ShareLinkStatus.ACTIVE,
        privacy_confirmation_id=payload.privacy_confirmation_id,
        expires_at=payload.expires_at,
    )
    db.add(link)
    await privacy_service.set_visibility_policy(
        db,
        user_id=user_id,
        target_type="book",
        target_id=book_id,
        visibility=PrivacyVisibility.SHARED_LINK,
    )
    await db.commit()
    await db.refresh(link)
    return await _read_link(db, link, token=token)


async def list_user_share_links(db: AsyncSession, user_id: int, *, limit: int = 20, offset: int = 0) -> ShareLinkListRead:
    conditions = [ShareLink.user_id == user_id]
    result = await db.execute(select(ShareLink).where(*conditions).order_by(ShareLink.created_at.desc()).offset(offset).limit(limit))
    total = await db.scalar(select(func.count()).select_from(ShareLink).where(*conditions))
    return ShareLinkListRead(items=[await _read_link(db, link) for link in result.scalars().all()], total=total or 0, limit=limit, offset=offset)


async def update_share_link(db: AsyncSession, user_id: int, share_id: int, payload: ShareLinkUpdate) -> ShareLinkRead:
    link = await _find_user_link(db, user_id, share_id)
    data = payload.model_dump(exclude_unset=True)
    if "access_scope" in data and payload.access_scope is not None:
        if payload.access_scope == ShareAccessScope.SPECIFIED:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="指定访问范围暂未开放")
        if payload.access_scope == ShareAccessScope.PASSWORD and payload.password is None and link.password_hash is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="密码分享必须设置访问密码")
        link.access_scope = payload.access_scope
    if "password" in data and payload.password is not None:
        link.password_hash = _hash(payload.password)
    if "status" in data and payload.status is not None and payload.status != link.status:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="分享状态请使用关闭或重新生成接口修改")
    if "expires_at" in data:
        link.expires_at = payload.expires_at
    await db.commit()
    await db.refresh(link)
    return await _read_link(db, link)


async def close_share_link(db: AsyncSession, user_id: int, share_id: int) -> ShareLinkRead:
    link = await _find_user_link(db, user_id, share_id)
    link.status = ShareLinkStatus.CLOSED
    await db.commit()
    await db.refresh(link)
    return await _read_link(db, link)


async def regenerate_share_token(db: AsyncSession, user_id: int, share_id: int) -> ShareLinkRead:
    link = await _find_user_link(db, user_id, share_id)
    token = _new_token()
    link.token_hash = _hash(token)
    link.status = ShareLinkStatus.ACTIVE
    await db.commit()
    await db.refresh(link)
    return await _read_link(db, link, token=token)


async def get_share_link(db: AsyncSession, token: str, *, password: str | None = None) -> PublicShareRead:
    link = await _find_public_link(db, token, password=password)
    return PublicShareRead(
        id=link.id,
        book_id=link.book_id,
        title=link.title_snapshot,
        cover_url=link.cover_url_snapshot,
        access_scope=link.access_scope,
        status=link.status,
        expires_at=link.expires_at,
    )


async def get_shared_player_payload(
    db: AsyncSession,
    token: str,
    *,
    options: BookPlayerOptions | None = None,
    visitor_id: str | None = None,
    user_agent: str | None = None,
    password: str | None = None,
) -> SharedPlayerPayload:
    link = await _find_public_link(db, token, password=password)
    log = ShareAccessLog(
        share_id=link.id,
        visitor_id=visitor_id,
        user_agent=user_agent,
        occurred_at=_now(),
    )
    db.add(log)
    await db.commit()
    payload = await book_service.get_player_payload(db, book_id=link.book_id, user_id=link.user_id, options=options)
    share = await get_share_link(db, token, password=password)
    return SharedPlayerPayload(**payload.model_dump(), share=share)
