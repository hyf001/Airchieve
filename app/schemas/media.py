import mimetypes
import os
from pydantic import BaseModel
from typing import Optional


class FileInfo(BaseModel):
    model_config = {"frozen": True}

    name: str
    path: Optional[str] = None
    size: int = 0  # 文件大小（字节）
    mime_type: str = "application/octet-stream"
    thumbnail_url: Optional[str] = None  # 缩略图URL

    def __init__(self, **_):
        raise TypeError("FileInfo 只能通过 from_path() 方法创建")

    @classmethod
    def from_path(cls, path: str, name: Optional[str] = None, thumbnail_url: Optional[str] = None) -> "FileInfo":
        """根据文件路径自动推断 MIME 类型和文件大小"""
        file_name = name or os.path.basename(path)
        mime, _ = mimetypes.guess_type(path)
        file_size = os.path.getsize(path) if os.path.exists(path) else 0
        return cls.model_construct(
            name=file_name,
            path=path,
            size=file_size,
            mime_type=mime or "application/octet-stream",
            thumbnail_url=thumbnail_url
        )
