"""
OSS API
通过后端代理访问 OSS 文件，避免浏览器 CORS 限制
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.services import oss_service
from app.core.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/oss", tags=["oss"])


@router.get("/{object_key:path}")
async def get_oss_file(object_key: str):
    """
    代理读取 OSS 文件。
    前端通过此接口访问图片，无需直接请求 OSS（避免 CORS）。
    """
    try:
        data, content_type = await oss_service.download_bytes(object_key)
        return Response(
            content=data,
            media_type=content_type,
            headers={"Cache-Control": "private, max-age=86400"},
        )
    except Exception as e:
        logger.error("OSS文件读取失败 | key=%s error=%r", object_key, e)
        raise HTTPException(status_code=404, detail=f"文件不存在: {object_key}")
