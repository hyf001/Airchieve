"""
Project Service
项目业务逻辑服务
"""
import uuid
from pathlib import Path
from typing import TYPE_CHECKING, List

from fastapi import UploadFile
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.projects import Project

if TYPE_CHECKING:
    from app.schemas.media import FileInfo


async def create_project(name: str, user_id: int, description: str | None, db: AsyncSession) -> Project:
    """创建项目并初始化项目目录"""
    project_id = uuid.uuid4().hex

    # 创建项目记录
    project = Project(
        id=project_id,
        user_id=user_id,
        name=name,
        description=description,
    )
    db.add(project)
    await db.flush()

    # 初始化项目目录
    _init_project_dir(project_id)

    return project


async def get_project_by_id(project_id: str, db: AsyncSession) -> Project | None:
    """根据ID获取项目"""
    result = await db.execute(select(Project).where(Project.id == project_id))
    return result.scalar_one_or_none()


async def get_project_list(
    page: int,
    page_size: int,
    db: AsyncSession,
    user_id: int | None = None,
    name: str | None = None,
) -> tuple[List[Project], int]:
    """分页查询项目列表"""
    query = select(Project)
    count_query = select(func.count()).select_from(Project)

    # 按用户过滤
    if user_id is not None:
        query = query.where(Project.user_id == user_id)
        count_query = count_query.where(Project.user_id == user_id)

    # 按项目名称模糊过滤
    if name:
        query = query.where(Project.name.contains(name))
        count_query = count_query.where(Project.name.contains(name))

    # 查询总数
    total = (await db.execute(count_query)).scalar() or 0

    # 按创建时间倒序 + 分页
    offset = (page - 1) * page_size
    query = query.order_by(Project.created_at.desc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    projects = list(result.scalars().all())

    return projects, total


def _init_project_dir(project_id: str) -> None:
    """初始化项目目录结构"""
    project_dir = Path(settings.USER_PROJECTS_ROOT) / project_id

    # 创建项目目录及 assets 子目录
    assets_dir = project_dir / "assets"
    assets_dir.mkdir(parents=True, exist_ok=True)
    # 创建target 子目录
    targets_dir = project_dir / "targets"
    targets_dir.mkdir(parents=True, exist_ok=True)
    #创建 tmp 子目录
    tmp_dir = project_dir / "tmp"
    tmp_dir.mkdir(parents=True, exist_ok=True)


# 支持缩略图的文件扩展名
THUMBNAIL_SUPPORTED_EXTENSIONS = {
    # 图片
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico',
    # 文档
    '.pdf',
    '.doc', '.docx',  # Word
    '.xls', '.xlsx',  # Excel
    '.ppt', '.pptx',  # PowerPoint
    '.txt',
    '.csv',
    '.md',
}


def _supports_thumbnail(file_path: Path) -> bool:
    """判断文件是否支持生成缩略图"""
    suffix = file_path.suffix.lower()
    return suffix in THUMBNAIL_SUPPORTED_EXTENSIONS


def get_project_files(project_id: str, subdir: str = "targets") -> List["FileInfo"]:
    """获取项目指定目录下的文件列表

    Args:
        project_id: 项目ID
        subdir: 子目录名称，默认为 targets
    """
    from app.schemas.media import FileInfo

    target_dir = Path(settings.USER_PROJECTS_ROOT) / project_id / subdir

    if not target_dir.exists():
        return []

    files = []
    for file_path in target_dir.iterdir():
        if file_path.is_file():
            # 构建缩略图URL（支持图片、PDF、Office文档、文本文件等）
            thumbnail_url = None
            if _supports_thumbnail(file_path):
                thumbnail_url = f"/api/v1/projects/{project_id}/files/{subdir}/{file_path.name}/thumbnail"

            file_info = FileInfo.from_path(
                path=str(file_path),
                thumbnail_url=thumbnail_url
            )
            files.append(file_info)

    # 按文件名排序
    files.sort(key=lambda f: f.name)
    return files


async def upload_project_file(
    project_id: str,
    subdir: str,
    file: UploadFile,
) -> str:
    """上传文件到项目目录

    Args:
        project_id: 项目ID
        subdir: 子目录名称（如 targets, assets, tmp）
        file: 上传的文件

    Returns:
        保存后的文件名
    """
    # 目标目录
    target_dir = Path(settings.USER_PROJECTS_ROOT) / project_id / subdir

    # 确保目标目录存在
    target_dir.mkdir(parents=True, exist_ok=True)

    # 获取文件名，如果为空则使用默认名称
    filename = file.filename or "uploaded_file"
    file_path = target_dir / filename

    # 如果文件已存在，添加序号后缀
    counter = 1
    while file_path.exists():
        stem = file_path.stem
        suffix = file_path.suffix
        file_path = target_dir / f"{stem}_{counter}{suffix}"
        counter += 1

    # 保存文件
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    return file_path.name