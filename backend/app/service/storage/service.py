import asyncio
import base64
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import PurePosixPath
from urllib.parse import quote
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.model.asset import Asset, AssetKind, AssetStatus, AssetVisibility
from app.model.storage import StorageUploadSession, UploadPurpose, UploadSessionStatus
from app.schema.asset import AssetStorageDTO
from app.schema.storage import UploadCompleteRequest, UploadSessionCreate, UploadSessionRead

MAX_UPLOAD_BYTES: dict[UploadPurpose, int] = {
    UploadPurpose.CHARACTER: 20 * 1024 * 1024,
    UploadPurpose.VOICE: 50 * 1024 * 1024,
    UploadPurpose.BACKGROUND_MUSIC: 80 * 1024 * 1024,
    UploadPurpose.STORY_FILE: 3 * 1024 * 1024,
    UploadPurpose.BOOK_MEDIA: 80 * 1024 * 1024,
    UploadPurpose.EXPORT: 200 * 1024 * 1024,
    UploadPurpose.TASK_RESULT: 200 * 1024 * 1024,
}


@lru_cache
def _get_oss_bucket():
    try:
        import oss2
    except ImportError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="OSS SDK 未安装，请安装 oss2") from exc
    required = {
        "OSS_ACCESS_KEY_ID": settings.OSS_ACCESS_KEY_ID,
        "OSS_ACCESS_KEY_SECRET": settings.OSS_ACCESS_KEY_SECRET,
        "OSS_ENDPOINT": settings.OSS_ENDPOINT,
        "OSS_BUCKET_NAME": settings.OSS_BUCKET_NAME,
    }
    missing = [key for key, value in required.items() if not value]
    if missing:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"OSS 配置缺失：{', '.join(missing)}")
    auth = oss2.Auth(settings.OSS_ACCESS_KEY_ID, settings.OSS_ACCESS_KEY_SECRET)
    return oss2.Bucket(auth, settings.OSS_ENDPOINT, settings.OSS_BUCKET_NAME)


def _sign_oss_url(method: str, storage_key: str, expires_in: int, *, headers: dict[str, str] | None = None) -> str:
    bucket = _get_oss_bucket()
    return bucket.sign_url(method, storage_key, expires_in, headers=headers, slash_safe=True)


def get_file_url(storage_key: str, expires_in: int | None = None) -> str:
    if not settings.OSS_BUCKET_NAME or not settings.OSS_ENDPOINT:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="OSS 配置缺失：OSS_BUCKET_NAME, OSS_ENDPOINT")
    endpoint = settings.OSS_ENDPOINT.removeprefix("https://").removeprefix("http://").rstrip("/")
    path = quote(storage_key.lstrip("/"), safe="/")
    return f"https://{settings.OSS_BUCKET_NAME}.{endpoint}/{path}"


def _guess_asset_kind(mime_type: str) -> AssetKind:
    if mime_type.startswith("image/"):
        return AssetKind.IMAGE
    if mime_type.startswith("audio/"):
        return AssetKind.AUDIO
    if mime_type.startswith("video/"):
        return AssetKind.VIDEO
    if mime_type == "application/pdf":
        return AssetKind.PDF
    return AssetKind.OTHER


def _asset_storage_key(asset_kind: AssetKind, user_id: int | None, filename: str, *, path_scope: str | None = None) -> str:
    extension = PurePosixPath(filename).suffix.lower()
    owner_segment = str(user_id) if user_id is not None else "system"
    if path_scope:
        return f"asset/{path_scope}/user/{owner_segment}/{uuid4().hex}{extension}"
    return f"asset/{asset_kind.value}/user/{owner_segment}/{uuid4().hex}{extension}"


def _as_aware_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


async def create_upload_session(db: AsyncSession, user_id: int, payload: UploadSessionCreate) -> UploadSessionRead:
    max_size = MAX_UPLOAD_BYTES[payload.purpose]
    if payload.byte_size is not None and payload.byte_size > max_size:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="文件大小超过当前上传类型限制")
    asset_kind = _guess_asset_kind(payload.mime_type)
    storage_key = _asset_storage_key(asset_kind, user_id, payload.filename)
    upload_headers = {"Content-Type": payload.mime_type}
    upload_url = _sign_oss_url("PUT", storage_key, settings.OSS_UPLOAD_EXPIRE_SECONDS, headers=upload_headers)
    session = StorageUploadSession(
        user_id=user_id,
        purpose=payload.purpose,
        filename=payload.filename,
        mime_type=payload.mime_type,
        max_byte_size=max_size,
        storage_key=storage_key,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return UploadSessionRead(
        id=session.id,
        user_id=session.user_id,
        purpose=session.purpose,
        filename=session.filename,
        mime_type=session.mime_type,
        max_byte_size=session.max_byte_size,
        storage_key=session.storage_key,
        upload_url=upload_url,
        upload_method="PUT",
        upload_headers=upload_headers,
        status=session.status,
        expires_at=session.expires_at,
        created_at=session.created_at,
        updated_at=session.updated_at,
    )


async def complete_upload(
    db: AsyncSession,
    user_id: int,
    upload_session_id: int,
    payload: UploadCompleteRequest,
    *,
    allow_system_visibility: bool = False,
) -> AssetStorageDTO:
    session = await db.get(StorageUploadSession, upload_session_id)
    if session is None or session.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="上传会话不存在")
    if session.status != UploadSessionStatus.CREATED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="上传会话不可重复完成")
    if _as_aware_utc(session.expires_at) < datetime.now(timezone.utc):
        session.status = UploadSessionStatus.EXPIRED
        await db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="上传会话已过期")
    if payload.byte_size is not None and payload.byte_size > session.max_byte_size:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="文件大小超过当前上传类型限制")
    object_size = await _get_uploaded_object_size(session.storage_key)
    if object_size is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="文件尚未上传到 OSS")
    if object_size > session.max_byte_size:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OSS 文件大小超过当前上传类型限制")
    if payload.byte_size is not None and payload.byte_size != object_size:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="上传文件大小与 OSS 文件不一致")
    if payload.visibility == AssetVisibility.SYSTEM and not allow_system_visibility:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权创建系统素材")

    asset = Asset(
        owner_user_id=user_id,
        asset_kind=payload.asset_kind or _guess_asset_kind(session.mime_type),
        storage_key=session.storage_key,
        mime_type=session.mime_type,
        byte_size=object_size,
        checksum=payload.checksum,
        visibility=payload.visibility,
        status=AssetStatus.READY,
    )
    db.add(asset)
    session.status = UploadSessionStatus.COMPLETED
    await db.commit()
    await db.refresh(asset)
    return AssetStorageDTO(
        id=asset.id,
        storage_key=asset.storage_key,
        url=get_file_url(asset.storage_key),
        mime_type=asset.mime_type,
        byte_size=asset.byte_size,
    )


async def get_asset_url(db: AsyncSession, asset_id: int, *, user_id: int | None = None, expires_in: int | None = None) -> str:
    asset = await db.get(Asset, asset_id)
    if asset is None or asset.status != AssetStatus.READY:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")
    if asset.visibility == AssetVisibility.PRIVATE and asset.owner_user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问该文件")
    return get_file_url(asset.storage_key, expires_in=expires_in)


async def save_generated_data_url(
    db: AsyncSession,
    user_id: int,
    *,
    data_url: str,
    asset_kind: AssetKind,
    filename_extension: str,
    visibility: AssetVisibility = AssetVisibility.PRIVATE,
    path_scope: str | None = None,
) -> AssetStorageDTO:
    if not data_url.startswith("data:") or ";base64," not in data_url:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="生成结果不是有效 data URL")
    metadata, base64_payload = data_url.split(";base64,", 1)
    mime_type = metadata.removeprefix("data:") or "application/octet-stream"
    try:
        content = base64.b64decode(base64_payload)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="生成结果 base64 无法解码") from exc
    storage_key = _asset_storage_key(asset_kind, user_id, f"generated{filename_extension}", path_scope=path_scope)
    await asyncio.to_thread(_get_oss_bucket().put_object, storage_key, content, headers={"Content-Type": mime_type})
    asset = Asset(
        owner_user_id=user_id,
        asset_kind=asset_kind,
        storage_key=storage_key,
        mime_type=mime_type,
        byte_size=len(content),
        visibility=visibility,
        status=AssetStatus.READY,
    )
    db.add(asset)
    await db.flush()
    return AssetStorageDTO(
        id=asset.id,
        storage_key=asset.storage_key,
        url=get_file_url(asset.storage_key),
        mime_type=asset.mime_type,
        byte_size=asset.byte_size,
    )


async def save_base64_asset(
    db: AsyncSession,
    user_id: int | None,
    *,
    base64_data: str,
    mime_type: str,
    asset_kind: AssetKind,
    filename: str,
    visibility: AssetVisibility = AssetVisibility.PRIVATE,
    path_scope: str | None = None,
) -> AssetStorageDTO:
    payload = base64_data
    if payload.startswith("data:") and ";base64," in payload:
        metadata, payload = payload.split(";base64,", 1)
        mime_type = metadata.removeprefix("data:") or mime_type
    try:
        content = base64.b64decode(payload, validate=True)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="base64 内容无法解码") from exc
    storage_key = _asset_storage_key(asset_kind, user_id, filename, path_scope=path_scope)
    await asyncio.to_thread(_get_oss_bucket().put_object, storage_key, content, headers={"Content-Type": mime_type})
    asset = Asset(
        owner_user_id=user_id,
        asset_kind=asset_kind,
        storage_key=storage_key,
        mime_type=mime_type,
        byte_size=len(content),
        visibility=visibility,
        status=AssetStatus.READY,
    )
    db.add(asset)
    await db.flush()
    return AssetStorageDTO(
        id=asset.id,
        storage_key=asset.storage_key,
        url=get_file_url(asset.storage_key),
        mime_type=asset.mime_type,
        byte_size=asset.byte_size,
    )


async def _get_uploaded_object_size(storage_key: str) -> int | None:
    try:
        meta = await asyncio.to_thread(_get_oss_bucket().get_object_meta, storage_key)
    except Exception as exc:
        if exc.__class__.__name__ in {"NoSuchKey", "NoSuchBucket"}:
            return None
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="无法确认 OSS 文件状态") from exc
    content_length = meta.headers.get("Content-Length") or meta.headers.get("content-length")
    if content_length is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OSS 文件元数据缺少 Content-Length")
    try:
        size = int(content_length)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OSS 文件大小元数据无效") from exc
    return size
