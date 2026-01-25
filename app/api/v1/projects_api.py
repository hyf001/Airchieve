"""
Projects API
项目相关接口
"""
import mimetypes
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.services.project_service import create_project, get_project_list, get_project_files, upload_project_file
from app.services.thumbnail_service import generate_thumbnail

router = APIRouter()


class ProjectCreateRequest(BaseModel):
    """创建项目请求"""
    name: str
    description: str | None = None


class ProjectCreateResponse(BaseModel):
    """创建项目响应"""
    id: str
    name: str
    description: str | None = None
    status: str


class ProjectListResponse(BaseModel):
    """项目列表响应"""
    total: int
    page: int
    page_size: int
    items: list[ProjectCreateResponse]


class FileInfoResponse(BaseModel):
    """文件信息响应"""
    name: str
    size: int
    mime_type: str
    thumbnail_url: str | None = None


class ProjectFilesResponse(BaseModel):
    """项目文件列表响应"""
    items: list[FileInfoResponse]


class UploadFileResponse(BaseModel):
    """上传文件响应"""
    filename: str
    message: str


@router.post("", response_model=ProjectCreateResponse)
async def create_project_api(
    req: ProjectCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建项目"""
    project = await create_project(
        name=req.name,
        user_id=user.id,
        description=req.description,
        db=db,
    )
    return ProjectCreateResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        status=project.status,
    )


@router.get("", response_model=ProjectListResponse)
async def list_projects_api(
    page: int = Query(default=1, ge=1, description="页码"),
    page_size: int = Query(default=10, ge=1, le=100, description="每页数量"),
    name: str | None = Query(default=None, description="项目名称"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """分页查询项目列表"""
    projects, total = await get_project_list(
        page=page,
        page_size=page_size,
        db=db,
        user_id=user.id,
        name=name,
    )
    return ProjectListResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[
            ProjectCreateResponse(
                id=p.id,
                name=p.name,
                description=p.description,
                status=p.status,
            )
            for p in projects
        ],
    )


@router.post("/{project_id}/files/assets", response_model=UploadFileResponse)
async def upload_file_api(
    project_id: str,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    """上传文件到项目 assets 目录

    Args:
        project_id: 项目ID
        file: 上传的文件
    """
    filename = await upload_project_file(
        project_id=project_id,
        subdir="assets",
        file=file,
    )
    return UploadFileResponse(
        filename=filename,
        message="文件上传成功",
    )


@router.get("/{project_id}/files", response_model=ProjectFilesResponse)
async def get_project_files_api(
    project_id: str,
    user: User = Depends(get_current_user),
):
    """获取项目 targets 目录下的文件列表"""
    files = get_project_files(project_id)
    return ProjectFilesResponse(
        items=[
            FileInfoResponse(
                name=f.name,
                size=f.size,
                mime_type=f.mime_type,
                thumbnail_url=f.thumbnail_url,
            )
            for f in files
        ]
    )


@router.get("/{project_id}/files/{subdir}", response_model=ProjectFilesResponse)
async def get_project_files_by_subdir_api(
    project_id: str,
    subdir: str,
    user: User = Depends(get_current_user),
):
    """获取项目指定目录下的文件列表

    Args:
        project_id: 项目ID
        subdir: 子目录名称（如 targets, assets, tmp）
    """
    files = get_project_files(project_id, subdir=subdir)
    return ProjectFilesResponse(
        items=[
            FileInfoResponse(
                name=f.name,
                size=f.size,
                mime_type=f.mime_type,
                thumbnail_url=f.thumbnail_url,
            )
            for f in files
        ]
    )


@router.get("/{project_id}/files/{subdir}/{filename}/thumbnail")
async def get_file_thumbnail_api(
    project_id: str,
    subdir: str,
    filename: str,
    user: User = Depends(get_current_user),
):
    """获取文件缩略图

    Args:
        project_id: 项目ID
        subdir: 子目录名称（如 targets, assets）
        filename: 文件名
    """
    # 构建文件路径
    file_path = Path(settings.USER_PROJECTS_ROOT) / project_id / subdir / filename

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="文件不存在")

    # 生成缩略图
    thumbnail_data = generate_thumbnail(str(file_path))

    if thumbnail_data is None:
        raise HTTPException(status_code=500, detail="缩略图生成失败")

    return Response(
        content=thumbnail_data,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=86400"},  # 缓存1天
    )


@router.get("/{project_id}/files/{subdir}/{filename}")
async def get_file_content_api(
    project_id: str,
    subdir: str,
    filename: str,
    user: User = Depends(get_current_user),
):
    """获取文件内容

    Args:
        project_id: 项目ID
        subdir: 子目录名称（如 targets, assets）
        filename: 文件名
    """
    file_path = Path(settings.USER_PROJECTS_ROOT) / project_id / subdir / filename

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="文件不存在")

    # 获取 MIME 类型
    mime_type, _ = mimetypes.guess_type(str(file_path))
    if mime_type is None:
        mime_type = "application/octet-stream"

    return FileResponse(
        path=file_path,
        media_type=mime_type,
        filename=filename,
    )
