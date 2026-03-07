"""
OSS Service
阿里云 OSS 对象存储服务
"""
import asyncio
import base64

import httpx
import oss2

from app.core.config import settings
from app.core.utils.logger import get_logger

logger = get_logger(__name__)

# 通过后端 API 访问 OSS 的前缀（避免 CORS）
_OSS_API_PREFIX = f"{settings.API_V1_STR}/oss"


def _get_bucket() -> oss2.Bucket:
    auth = oss2.Auth(settings.OSS_ACCESS_KEY_ID, settings.OSS_ACCESS_KEY_SECRET)
    return oss2.Bucket(auth, settings.OSS_ENDPOINT, settings.OSS_BUCKET_NAME)


def get_public_url(object_key: str) -> str:
    """返回 OSS 对象的直接公开访问 URL（仅内部使用）"""
    if settings.OSS_BASE_URL:
        return f"{settings.OSS_BASE_URL.rstrip('/')}/{object_key}"
    return f"https://{settings.OSS_BUCKET_NAME}.{settings.OSS_ENDPOINT}/{object_key}"


def get_api_url(object_key: str) -> str:
    """返回通过后端 API 代理访问的 URL（前端使用，无 CORS 限制）"""
    return f"{_OSS_API_PREFIX}/{object_key}"


async def download_bytes(object_key: str) -> tuple[bytes, str]:
    """从 OSS 下载文件，返回 (bytes, content_type)"""
    bucket = _get_bucket()
    result = await asyncio.to_thread(bucket.get_object, object_key)
    data: bytes = result.read() or b""
    content_type: str = result.headers.get("Content-Type") or "application/octet-stream"
    return data, content_type


async def upload_bytes(data: bytes, object_key: str, content_type: str = "image/png") -> str:
    """上传字节数据到 OSS，返回后端 API 代理 URL"""
    bucket = _get_bucket()
    headers = {"Content-Type": content_type}
    await asyncio.to_thread(bucket.put_object, object_key, data, headers=headers)
    url = get_api_url(object_key)
    logger.info("OSS上传成功 | key=%s size=%d url=%s", object_key, len(data), url)
    return url


async def upload_from_url(source_url: str, object_key: str) -> str:
    """从 URL 或 base64 data URL 上传到 OSS，返回后端 API 代理 URL"""
    if source_url.startswith("data:"):
        # data:image/png;base64,xxxx
        header, encoded = source_url.split(",", 1)
        content_type = header.split(";")[0].replace("data:", "").strip()
        data = base64.b64decode(encoded)
        logger.info("解析data URL完成 | content_type=%s size=%d", content_type, len(data))
    else:
        async with httpx.AsyncClient() as client:
            response = await client.get(source_url, follow_redirects=True, timeout=30)
            response.raise_for_status()
            content_type = response.headers.get("content-type", "image/png").split(";")[0].strip()
            data = response.content
        logger.info("从URL下载完成 | size=%d content_type=%s", len(data), content_type)

    return await upload_bytes(data, object_key, content_type)
