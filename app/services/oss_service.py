"""
OSS Service
阿里云 OSS 对象存储服务（纯异步 httpx 实现，OSS v1 签名）
"""
import base64
import hashlib
import hmac
from email.utils import formatdate

import httpx

from app.core.config import settings
from app.core.utils.logger import get_logger

logger = get_logger(__name__)

# 共享连接池，复用 TCP/TLS 连接，避免每次请求重新建连
_client = httpx.AsyncClient(timeout=30, limits=httpx.Limits(max_connections=50, max_keepalive_connections=20))

# 通过后端 API 访问 OSS 的前缀（避免 CORS）
_OSS_API_PREFIX = f"{settings.API_V1_STR}/oss"


def get_public_url(object_key: str) -> str:
    """返回 OSS 对象的直接公开访问 URL（仅内部使用）"""
    if settings.OSS_BASE_URL:
        return f"{settings.OSS_BASE_URL.rstrip('/')}/{object_key}"
    return f"https://{settings.OSS_BUCKET_NAME}.{settings.OSS_ENDPOINT}/{object_key}"


def get_api_url(object_key: str) -> str:
    """返回通过后端 API 代理访问的 URL（前端使用，无 CORS 限制）"""
    return f"{_OSS_API_PREFIX}/{object_key}"


def _oss_url(object_key: str) -> str:
    return f"https://{settings.OSS_BUCKET_NAME}.{settings.OSS_ENDPOINT}/{object_key}"


def _auth_header(method: str, object_key: str, content_type: str = "", content_md5: str = "") -> dict[str, str]:
    """生成 OSS v1 签名请求头"""
    date = formatdate(usegmt=True)
    canonical_resource = f"/{settings.OSS_BUCKET_NAME}/{object_key}"
    string_to_sign = "\n".join([method, content_md5, content_type, date, canonical_resource])
    signature = base64.b64encode(
        hmac.new(
            settings.OSS_ACCESS_KEY_SECRET.encode(),
            string_to_sign.encode(),
            hashlib.sha1,
        ).digest()
    ).decode()

    headers: dict[str, str] = {
        "Date": date,
        "Authorization": f"OSS {settings.OSS_ACCESS_KEY_ID}:{signature}",
    }
    if content_type:
        headers["Content-Type"] = content_type
    if content_md5:
        headers["Content-MD5"] = content_md5
    return headers


async def download_bytes(object_key: str) -> tuple[bytes, str]:
    """从 OSS 下载文件，返回 (bytes, content_type)"""
    headers = _auth_header("GET", object_key)
    response = await _client.get(_oss_url(object_key), headers=headers)
    response.raise_for_status()
    content_type = response.headers.get("content-type", "application/octet-stream").split(";")[0].strip()
    return response.content, content_type


async def upload_bytes(data: bytes, object_key: str, content_type: str = "image/png") -> str:
    """上传字节数据到 OSS，返回后端 API 代理 URL"""
    md5 = base64.b64encode(hashlib.md5(data).digest()).decode()
    headers = _auth_header("PUT", object_key, content_type, md5)
    response = await _client.put(_oss_url(object_key), content=data, headers=headers, timeout=60)
    response.raise_for_status()
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
        response = await _client.get(source_url, follow_redirects=True)
        response.raise_for_status()
        content_type = response.headers.get("content-type", "image/png").split(";")[0].strip()
        data = response.content
        logger.info("从URL下载完成 | size=%d content_type=%s", len(data), content_type)

    return await upload_bytes(data, object_key, content_type)
