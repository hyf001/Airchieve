"""
Storybook API
绘本接口 - 增删改查
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.storybook import Storybook
from app.schemas.storybook import (
    CreateStorybookFromStoryRequest,
    CreateStoryRequest,
    CreateStoryResponse,
    EditImageRequest,
    GenerateStoryboardRequest,
    GenerateStoryboardResponse,
    InsertPageAsyncResponse,
    InsertPagesRequest,
    StoryboardItemResponse,
    StorybookCreateResponse,
    StorybookListResponse,
    StorybookResponse,
    StorybookStatusResponse,
    TerminateResponse,
    UpdatePublicStatusRequest,
)
from app.models.user import User
from app.services.storybook_service import (
    build_cover_storyboard,
    get_storybook,
    get_storybook_status,
    list_storybooks as list_storybooks_service,
    generate_edited_image,
    insert_pages_async,
    run_insert_pages_background,
    terminate_storybook,
    create_story_only,
    create_storybook_from_story_async,
    run_create_storybook_from_story_background,
    create_storyboard_only,
)
from app.services.points_service import InsufficientPointsError

router = APIRouter(prefix="/storybooks", tags=["storybooks"])

INSUFFICIENT_POINTS_CODE = "INSUFFICIENT_POINTS"
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


@router.post("/story", response_model=CreateStoryResponse)
async def create_story_endpoint(
    req: CreateStoryRequest,
    current_user: User = Depends(get_current_user),
):
    """
    创建纯文本故事（不含分镜和图片）

    返回故事标题和内容，可用于后续创建绘本。
    """
    try:
        title, content = await create_story_only(
            instruction=req.instruction,
            word_count=req.word_count,
            story_type=req.story_type,
            language=req.language,
            age_group=req.age_group,
            cli_type=req.cli_type,
        )
        return CreateStoryResponse(title=title, content=content)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/storyboard", response_model=GenerateStoryboardResponse)
async def generate_storyboard_endpoint(
    req: GenerateStoryboardRequest,
    current_user: User = Depends(get_current_user),
):
    """
    生成分镜（不扣费，不保存）

    基于故事内容生成分镜描述，返回每页的文本和分镜信息。
    前端可预览和编辑后，再调用创建绘本接口生成图片。
    """
    try:
        story_texts, storyboards = await create_storyboard_only(
            story_content=req.story_content,
            page_count=req.page_count,
            cli_type=req.cli_type,
        )

        return GenerateStoryboardResponse(
            storyboards=[
                StoryboardItemResponse(
                    text=req.title or "封面",
                    storyboard=dict(
                        build_cover_storyboard(req.title or "封面", req.story_content, storyboards)
                    ),
                    page_type="cover",
                ),
                *[
                    StoryboardItemResponse(
                        text=text,
                        storyboard=dict(sb) if sb else None,
                        page_type="content",
                    )
                    for text, sb in zip(story_texts, storyboards)
                ],
            ]
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/from-story", status_code=status.HTTP_202_ACCEPTED, response_model=StorybookCreateResponse)
async def create_storybook_from_story_endpoint(
    req: CreateStorybookFromStoryRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """
    基于已有的故事和分镜创建绘本（异步，轮询模式）

    从请求的 pages 字段中提取故事文本和分镜信息并保存到数据库，
    后台任务只负责生成图片。

    立即返回绘本 ID，后台执行生成。客户端轮询 GET /{id} 的 status 字段：
    init → creating → finished / error
    """
    try:
        storybook_id, title, template = await create_storybook_from_story_async(
            title=req.title,
            description=req.description,
            user_id=current_user.id,
            pages=req.pages,
            template_id=req.template_id,
            cli_type=req.cli_type,
            aspect_ratio=req.aspect_ratio,
            image_size=req.image_size,
        )
    except InsufficientPointsError as e:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={"code": INSUFFICIENT_POINTS_CODE, "message": str(e)},
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    background_tasks.add_task(
        run_create_storybook_from_story_background,
        storybook_id,
        current_user.id,
        template,
        req.aspect_ratio.value,
        req.image_size.value,
        req.cli_type,
        req.images,
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


@router.get("/{storybook_id}/status", response_model=StorybookStatusResponse)
async def get_storybook_status_endpoint(
    storybook_id: int,
):
    """获取绘本状态（轻量接口，不查询 pages，适合高频轮询）"""
    result = await get_storybook_status(storybook_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="绘本不存在"
        )
    return result


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
