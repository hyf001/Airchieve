"""
Storybook API
绘本接口 - 增删改查
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.storybook import Storybook
from app.models.user import User
from app.services.storybook_service import (
    create_storybook_async,
    run_create_storybook_background,
    edit_storybook_async,
    run_edit_storybook_background,
    run_edit_page_background,
    get_storybook,
    update_storybook_pages,
    list_storybooks as list_storybooks_service,
    generate_storybook_image,
)
from app.services.points_service import InsufficientPointsError, check_page_edit_points

router = APIRouter(prefix="/storybooks", tags=["storybooks"])

INSUFFICIENT_POINTS_CODE = "INSUFFICIENT_POINTS"


# ============ Schemas ============
class CreateStorybookRequest(BaseModel):
    """创建绘本请求"""
    instruction: str = Field(..., min_length=1, max_length=1000, description="用户指令/绘本描述")
    template_id: Optional[int] = Field(None, description="模版ID")
    images: Optional[List[str]] = Field(None, description="base64编码的参考图片列表")


class StorybookPageResponse(BaseModel):
    """绘本页面响应"""
    text: str = Field(..., description="页面文本")
    image_url: str = Field(..., description="图片URL")


class StorybookResponse(BaseModel):
    """绘本响应"""
    id: int
    title: str
    description: Optional[str]
    creator: str
    pages: Optional[List[StorybookPageResponse]]
    status: str
    error_message: Optional[str] = None
    instruction: Optional[str] = None
    template_id: Optional[int] = None

    class Config:
        from_attributes = True


class StorybookListResponse(BaseModel):
    """绘本列表响应"""
    id: int
    title: str
    description: Optional[str]
    creator: str
    status: str
    is_public: bool
    created_at: str
    pages: Optional[List[StorybookPageResponse]] = None

    class Config:
        from_attributes = True


class EditStorybookRequest(BaseModel):
    """编辑绘本请求"""
    instruction: str = Field(..., min_length=1, max_length=1000, description="编辑指令")
    images: Optional[List[str]] = Field(None, description="base64编码的参考图片列表")


class EditStorybookPageRequest(BaseModel):
    """编辑绘本单页请求"""
    instruction: str = Field(..., min_length=1, max_length=1000, description="编辑指令")


class UpdatePublicStatusRequest(BaseModel):
    """更新公开状态请求"""
    is_public: bool = Field(..., description="是否公开")


class StorybookCreateResponse(BaseModel):
    """创建/编辑绘本的异步响应"""
    id: int
    title: str
    status: str


class EditPageAsyncResponse(BaseModel):
    """编辑单页的异步响应"""
    storybook_id: int
    status: str


# ============ Endpoints ============

@router.post("", status_code=status.HTTP_202_ACCEPTED, response_model=StorybookCreateResponse)
async def create_storybook_endpoint(
    req: CreateStorybookRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """
    创建绘本（异步，轮询模式）

    立即返回绘本 ID，后台执行生成。客户端轮询 GET /{id} 的 status 字段：
    init → creating → finished / error
    """
    try:
        storybook_id, title, systemprompt = await create_storybook_async(
            instruction=req.instruction,
            template_id=req.template_id,
            user_id=current_user.id,
        )
    except InsufficientPointsError as e:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={"code": INSUFFICIENT_POINTS_CODE, "message": str(e)},
        )

    background_tasks.add_task(
        run_create_storybook_background,
        storybook_id,
        req.instruction,
        current_user.id,
        systemprompt,
        req.images,
    )

    return StorybookCreateResponse(id=storybook_id, title=title, status="init")


@router.put("/{storybook_id}", status_code=status.HTTP_202_ACCEPTED, response_model=StorybookCreateResponse)
async def edit_storybook_endpoint(
    storybook_id: int,
    req: EditStorybookRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """
    编辑绘本（异步，轮询模式）—— 创建新版本，保留原绘本

    立即返回新绘本 ID，后台执行生成。客户端轮询 GET /{new_id} 的 status 字段。
    """
    try:
        new_id, new_title, systemprompt, original_pages = await edit_storybook_async(
            storybook_id=storybook_id,
            instruction=req.instruction,
            user_id=current_user.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except InsufficientPointsError as e:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={"code": INSUFFICIENT_POINTS_CODE, "message": str(e)},
        )

    background_tasks.add_task(
        run_edit_storybook_background,
        new_id,
        req.instruction,
        current_user.id,
        systemprompt,
        req.images,
        original_pages,
    )

    return StorybookCreateResponse(id=new_id, title=new_title, status="init")


@router.get("", response_model=List[StorybookListResponse])
async def list_storybooks(
    creator: Optional[str] = Query(None, description="按创建者筛选"),
    title: Optional[str] = Query(None, description="按标题模糊匹配"),
    status: Optional[str] = Query(None, description="按状态筛选"),
    is_public: Optional[bool] = Query(None, description="按是否公开筛选"),
    limit: int = Query(20, ge=1, le=100, description="返回数量限制"),
    offset: int = Query(0, ge=0, description="偏移量"),
    db: AsyncSession = Depends(get_db)
):
    """获取绘本列表"""
    storybooks = await list_storybooks_service(
        creator=creator,
        title=title,
        status=status,
        is_public=is_public,
        limit=limit,
        offset=offset
    )

    response_data = []
    for book in storybooks:
        response_data.append({
            "id": book.id,
            "title": book.title,
            "description": book.description,
            "creator": book.creator,
            "status": book.status,
            "is_public": book.is_public if book.is_public is not None else False,
            "created_at": book.created_at.isoformat() if book.created_at else "",
            "pages": book.pages if book.pages is not None else None
        })

    return response_data


@router.get("/{storybook_id}", response_model=StorybookResponse)
async def get_storybook_endpoint(
    storybook_id: int,
    db: AsyncSession = Depends(get_db)
):
    """获取绘本详情（含 status、error_message，用于轮询）"""
    storybook = await get_storybook(storybook_id)

    if not storybook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="绘本不存在"
        )

    return storybook


@router.patch("/{storybook_id}/pages/{page_index}", status_code=status.HTTP_202_ACCEPTED, response_model=EditPageAsyncResponse)
async def edit_storybook_page_endpoint(
    storybook_id: int,
    page_index: int,
    req: EditStorybookPageRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    编辑绘本单页（异步，轮询模式）

    立即返回 {storybook_id, status: "updating"}，后台执行生成。
    客户端轮询 GET /{storybook_id} 直到 status 变为 finished / error。
    """
    from sqlalchemy import select

    storybook = await get_storybook(storybook_id)
    if not storybook:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="绘本不存在")

    if not storybook.pages or page_index < 0 or page_index >= len(storybook.pages):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"无效的页码: {page_index}"
        )

    try:
        await check_page_edit_points(current_user.id)
    except InsufficientPointsError as e:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={"code": INSUFFICIENT_POINTS_CODE, "message": str(e)},
        )

    # 同步设置状态为 updating
    result = await db.execute(select(Storybook).where(Storybook.id == storybook_id))
    sb = result.scalar_one_or_none()
    if sb:
        sb.status = "updating"
        sb.error_message = None
        await db.commit()

    background_tasks.add_task(
        run_edit_page_background,
        storybook_id,
        page_index,
        req.instruction,
        current_user.id,
    )

    return EditPageAsyncResponse(storybook_id=storybook_id, status="updating")


@router.delete("/{storybook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_storybook_endpoint(
    storybook_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除绘本"""
    from sqlalchemy import select, delete

    storybook = await get_storybook(storybook_id)
    if not storybook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="绘本不存在"
        )

    try:
        await db.execute(delete(Storybook).where(Storybook.id == storybook_id))
        await db.commit()
        return None
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除绘本时发生错误: {str(e)}"
        )


@router.patch("/{storybook_id}/public", status_code=status.HTTP_200_OK)
async def update_public_status_endpoint(
    storybook_id: int,
    req: UpdatePublicStatusRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新绘本公开状态"""
    from sqlalchemy import select

    result = await db.execute(
        select(Storybook).where(Storybook.id == storybook_id)
    )
    storybook = result.scalar_one_or_none()

    if not storybook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="绘本不存在"
        )

    try:
        storybook.is_public = req.is_public
        await db.commit()
        return {"message": "公开状态已更新", "is_public": req.is_public}
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新公开状态时发生错误: {str(e)}"
        )


@router.get("/{storybook_id}/download", status_code=status.HTTP_200_OK)
async def download_storybook_image(
    storybook_id: int,
    current_user: User = Depends(get_current_user),
):
    """下载绘本横向长图（JPEG）"""
    storybook = await get_storybook(storybook_id)
    if not storybook:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="绘本不存在")

    image_data = await generate_storybook_image(storybook_id)

    if not image_data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="生成图片失败")

    filename = f"{storybook.title or 'storybook'}_{storybook_id}.jpg"
    filename = filename.replace("/", "-").replace("\\", "-").replace(":", "-")
    from urllib.parse import quote
    encoded_filename = quote(filename, safe='')

    return Response(
        content=image_data,
        media_type="image/jpeg",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
    )
