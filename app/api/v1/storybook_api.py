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
from app.models.enums import CliType, AspectRatio, ImageSize, PageType
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
    insert_pages_async,
    run_insert_pages_background,
    terminate_storybook,
    generate_cover_async,
    run_generate_cover_background,
    generate_back_cover_async,
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
    cli_type: CliType = Field(CliType.GEMINI, description="CLI类型")
    page_count: int = Field(10, ge=1, le=20, description="页数")
    aspect_ratio: AspectRatio = Field(AspectRatio.RATIO_16_9, description="图片比例")
    image_size: ImageSize = Field(ImageSize.SIZE_1K, description="图片尺寸")


class StorybookPageResponse(BaseModel):
    """绘本页面响应"""
    text: Optional[str] = Field(None, description="页面文本")
    image_url: Optional[str] = Field(None, description="图片URL")
    page_type: Optional[str] = Field(None, description="页面类型")
    storyboard: Optional[dict] = Field(None, description="分镜信息")

    class Config:
        from_attributes = True


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
    cli_type: CliType
    aspect_ratio: AspectRatio
    image_size: ImageSize

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
    cli_type: Optional[CliType]
    aspect_ratio: Optional[AspectRatio]
    image_size: Optional[ImageSize]

    class Config:
        from_attributes = True


class EditImageRequest(BaseModel):
    """图片编辑请求（仅生成图片，不写库）"""
    instruction: str = Field(..., min_length=1, max_length=1000, description="图片编辑指令")
    image_to_edit: str = Field(..., description="要编辑的图片 URL 或 base64 data URL")
    referenced_image: Optional[str] = Field(None, description="参考图片 URL 或 base64 data URL（可选）")
    storybook_id: int = Field(..., description="绘本ID，用于获取模型、清晰度、图片比例等配置")


class SavePageRequest(BaseModel):
    """直接保存页面内容请求"""
    text: str = Field(..., description="页面文字")
    image_url: str = Field(..., description="图片 URL 或 base64 data URL")


class ReorderPagesRequest(BaseModel):
    """重新排序页面请求"""
    order: List[int] = Field(..., description="原页面下标的新排列，例如 [2,0,1]")


class InsertPagesRequest(BaseModel):
    """插入页面请求"""
    insert_position: int = Field(..., ge=0, description="插入位置（从0开始，0表示在最前面插入）")
    count: int = Field(1, ge=1, le=5, description="插入页面数量（1-5）")
    instruction: str = Field("", description="插入指令")


class InsertPageAsyncResponse(BaseModel):
    """插入页面异步响应"""
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


class TerminateResponse(BaseModel):
    """中止响应"""
    success: bool
    message: str


class GenerateCoverRequest(BaseModel):
    """生成封面请求"""
    selected_page_indices: Optional[List[int]] = Field(None, description="用户选择的参考页索引列表；不传则自动选首/中/尾")


class GenerateCoverResponse(BaseModel):
    """生成封面响应"""
    storybook_id: int
    status: str


class GenerateBackCoverRequest(BaseModel):
    """生成封底请求"""
    image_data: str = Field(..., description="封底图片的 base64 数据")


class GenerateBackCoverResponse(BaseModel):
    """生成封底响应"""
    storybook_id: int
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
            image_url=req.image_to_edit,
            referenced_image=req.referenced_image,
            storybook_id=req.storybook_id,
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
        storybook_id, title, template = await create_storybook_async(
            instruction=req.instruction,
            template_id=req.template_id,
            user_id=current_user.id,
            cli_type=req.cli_type,
            page_count=req.page_count,
            aspect_ratio=req.aspect_ratio,
            image_size=req.image_size,
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
        template,
        req.images,
        req.page_count,
        req.aspect_ratio.value,
        req.image_size.value,
        req.cli_type,
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
            "pages": book.pages[:1] if book.pages else None,
            "cli_type": book.cli_type,
            "aspect_ratio": book.aspect_ratio,
            "image_size": book.image_size,
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
    return StorybookPageResponse(
        text=saved.text,
        image_url=saved.image_url,
        page_type=saved.page_type,
        storyboard=dict(saved.storyboard) if saved.storyboard else None,
    )


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


@router.post("/{storybook_id}/pages/insert", status_code=status.HTTP_202_ACCEPTED, response_model=InsertPageAsyncResponse)
async def insert_pages_endpoint(
    storybook_id: int,
    req: InsertPagesRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """
    在指定位置插入新页面（异步，轮询模式）。
    支持在任意位置插入页面。生成几页消耗几积分，成功后扣除。
    """
    try:
        await insert_pages_async(
            storybook_id=storybook_id,
            insert_position=req.insert_position,
            count=req.count,
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
        run_insert_pages_background,
        storybook_id,
        req.insert_position,
        req.count,
        req.instruction,
        current_user.id,
    )

    return InsertPageAsyncResponse(storybook_id=storybook_id, status="updating")


@router.post("/{storybook_id}/terminate", response_model=TerminateResponse)
async def terminate_storybook_endpoint(
    storybook_id: int,
    current_user: User = Depends(get_current_user),
):
    """中止正在生成的绘本"""
    success = await terminate_storybook(storybook_id)
    return TerminateResponse(
        success=success,
        message="已中止" if success else "中止失败或绘本不在生成中"
    )


@router.post("/{storybook_id}/cover/generate", status_code=status.HTTP_202_ACCEPTED, response_model=GenerateCoverResponse)
async def generate_cover_endpoint(
    storybook_id: int,
    req: GenerateCoverRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """
    手动触发封面生成（异步，轮询模式）。
    自动从现有内页选取参考图（>3页取首/中/尾，否则全选），生成后插入/替换 pages[0]。
    客户端轮询 GET /{id} 的 status 字段：updating → finished / error
    """
    storybook = await get_storybook(storybook_id)
    if not storybook:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="绘本不存在")
    if not storybook.pages:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="绘本暂无页面，无法生成封面")
    if storybook.status in ("creating", "updating"):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="绘本正在生成中，请稍后再试")
    if any(p.page_type == PageType.COVER for p in storybook.pages):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="封面已存在，不能重复生成")

    try:
        await check_creation_points(current_user.id)
    except InsufficientPointsError as e:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={"code": INSUFFICIENT_POINTS_CODE, "message": str(e)},
        )

    background_tasks.add_task(
        run_generate_cover_background,
        storybook_id,
        current_user.id,
        req.selected_page_indices,
    )

    return GenerateCoverResponse(storybook_id=storybook_id, status="updating")


@router.post("/{storybook_id}/backcover/generate", status_code=status.HTTP_200_OK, response_model=GenerateBackCoverResponse)
async def generate_back_cover_endpoint(
    storybook_id: int,
    req: GenerateBackCoverRequest,
    current_user: User = Depends(get_current_user),
):
    """
    生成封底（同步）。
    接收前端生成的封底图片（base64），添加到绘本最后一页。
    若已有封底则返回错误。
    """
    storybook = await get_storybook(storybook_id)
    if not storybook:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="绘本不存在")
    if not storybook.pages:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="绘本暂无页面，无法生成封底")
    if storybook.status in ("creating", "updating"):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="绘本正在生成中，请稍后再试")
    if any(p.page_type == PageType.BACK_COVER for p in storybook.pages):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="封底已存在，不能重复生成")

    try:
        await generate_back_cover_async(storybook_id, req.image_data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"生成封底失败: {str(e)}")

    # 获取更新后的绘本
    updated_storybook = await get_storybook(storybook_id)
    return GenerateBackCoverResponse(storybook_id=storybook_id, status=updated_storybook.status)
