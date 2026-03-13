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
    get_storybook,
    update_storybook_pages,
    list_storybooks as list_storybooks_service,
    generate_storybook_image,
    generate_edited_image,
    save_page_content,
    delete_page,
    reorder_pages,
    regenerate_pages_async,
    run_regenerate_pages_background,
)
from app.services.points_service import InsufficientPointsError, check_creation_points

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


class EditImageRequest(BaseModel):
    """图片编辑请求（仅生成图片，不写库）"""
    instruction: str = Field(..., min_length=1, max_length=1000, description="图片编辑指令")
    image: str = Field(..., description="当前图片 URL 或 base64 data URL")


class SavePageRequest(BaseModel):
    """直接保存页面内容请求"""
    text: str = Field(..., description="页面文字")
    image_url: str = Field(..., description="图片 URL 或 base64 data URL")


class ReorderPagesRequest(BaseModel):
    """重新排序页面请求"""
    order: List[int] = Field(..., description="原页面下标的新排列，例如 [2,0,1]")


class RegeneratePagesRequest(BaseModel):
    """再生成页请求"""
    page_indices: List[int] = Field(..., min_length=1, max_length=5, description="参考页面下标（1-5 页）")
    count: int = Field(1, ge=1, le=5, description="生成新页面数量（1-5）")
    instruction: str = Field("", description="再生成指令")


class RegeneratePageAsyncResponse(BaseModel):
    """再生成页异步响应"""
    storybook_id: int
    status: str


class UpdatePublicStatusRequest(BaseModel):
    """更新公开状态请求"""
    is_public: bool = Field(..., description="是否公开")


class StorybookCreateResponse(BaseModel):
    """创建/编辑绘本的异步响应"""
    id: int
    title: str
    status: str


# ============ Endpoints ============

@router.post("/image/edit")
async def edit_image_endpoint(
    req: EditImageRequest,
    current_user: User = Depends(get_current_user),
):
    """
    仅编辑图片，不修改文字，不写入数据库。
    返回 base64 data URL，由前端缓存，用户点保存后再调用 PUT /pages/{i} 写库。
    消耗 1 积分（积分不足则拒绝）。
    """
    try:
        image_base64 = await generate_edited_image(
            instruction=req.instruction,
            image_url=req.image,
            user_id=current_user.id,
        )
    except InsufficientPointsError as e:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={"code": INSUFFICIENT_POINTS_CODE, "message": str(e)},
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    return {"image": image_base64}


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
        storybook_id, title, systemprompt, style_prefix = await create_storybook_async(
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
        style_prefix,
    )

    return StorybookCreateResponse(id=storybook_id, title=title, status="init")


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
            "pages": book.pages[:1] if book.pages else None
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


@router.patch("/{storybook_id}/pages/reorder", response_model=StorybookResponse)
async def reorder_pages_endpoint(
    storybook_id: int,
    req: ReorderPagesRequest,
    current_user: User = Depends(get_current_user),
):
    """重新排列页面顺序，返回更新后的绘本。"""
    try:
        storybook = await reorder_pages(storybook_id, req.order)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return storybook


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


@router.put("/{storybook_id}/pages/{page_index}", response_model=StorybookPageResponse)
async def save_page_endpoint(
    storybook_id: int,
    page_index: int,
    req: SavePageRequest,
    current_user: User = Depends(get_current_user),
):
    """直接保存页面内容（文字 + 图片 URL），不触发 AI 生成。"""
    try:
        saved = await save_page_content(storybook_id, page_index, req.text, req.image_url)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return StorybookPageResponse(text=saved["text"], image_url=saved["image_url"])


@router.delete("/{storybook_id}/pages/{page_index}", response_model=StorybookResponse)
async def delete_page_endpoint(
    storybook_id: int,
    page_index: int,
    current_user: User = Depends(get_current_user),
):
    """删除指定页（至少保留 1 页），返回更新后的绘本。"""
    try:
        storybook = await delete_page(storybook_id, page_index)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return storybook


@router.post("/{storybook_id}/pages/merge", status_code=status.HTTP_202_ACCEPTED, response_model=RegeneratePageAsyncResponse)
async def regenerate_pages_endpoint(
    storybook_id: int,
    req: RegeneratePagesRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """
    基于选中页面再生成新页追加到末尾（异步，轮询模式）。
    原页保留不变。生成几页消耗几积分，成功后扣除。
    """
    try:
        await regenerate_pages_async(
            storybook_id=storybook_id,
            page_indices=req.page_indices,
            instruction=req.instruction,
            user_id=current_user.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except InsufficientPointsError as e:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={"code": INSUFFICIENT_POINTS_CODE, "message": str(e)},
        )

    background_tasks.add_task(
        run_regenerate_pages_background,
        storybook_id,
        req.page_indices,
        req.count,
        req.instruction,
        current_user.id,
    )

    return RegeneratePageAsyncResponse(storybook_id=storybook_id, status="updating")
