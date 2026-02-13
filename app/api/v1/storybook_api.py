"""
Storybook API
绘本接口 - 增删改查
"""
import json
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.storybook import Storybook, StorybookPage
from app.services.storybook_service import (
    create_storybook_stream,
    edit_storybook_stream,
    get_storybook,
    update_storybook_pages,
    edit_storybook_page,
    list_storybooks as list_storybooks_service,
)

router = APIRouter(prefix="/storybooks", tags=["storybooks"])


# ============ Schemas ============
class CreateStorybookRequest(BaseModel):
    """创建绘本请求"""
    instruction: str = Field(..., min_length=1, max_length=1000, description="用户指令/绘本描述")
    template_id: Optional[int] = Field(None, description="模版ID")
    images: Optional[List[str]] = Field(None, description="base64编码的参考图片列表")
    creator: str = Field("user", max_length=128, description="创建者名称")


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


# ============ Endpoints ============
@router.post("/stream", status_code=status.HTTP_200_OK)
async def create_storybook_stream_endpoint(
    req: CreateStorybookRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    创建绘本（流式版本）

    根据用户指令和风格自动生成绘本内容，实时返回生成进度。
    使用 Server-Sent Events (SSE) 格式返回。
    """
    async def event_generator():
        try:
            async for event in create_storybook_stream(
                instruction=req.instruction,
                template_id=req.template_id,
                images=req.images,
                creator=req.creator
            ):
                # 使用 SSE 格式发送事件
                yield f"data: {event}\n\n"

            # 发送结束事件
            yield "data: [DONE]\n\n"
        except Exception as e:
            # 发送错误事件
            import json
            error_event = json.dumps({
                "type": "error",
                "data": {
                    "error": str(e)
                }
            }, ensure_ascii=False)
            yield f"data: {error_event}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.put("/{storybook_id}/stream", status_code=status.HTTP_200_OK)
async def edit_storybook_stream_endpoint(
    storybook_id: int,
    req: EditStorybookRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    编辑绘本（流式版本，创建新版本）

    根据编辑指令对绘本进行重新生成，创建一个新的绘本保留原版本。
    使用 Server-Sent Events (SSE) 格式返回实时进度。
    """
    # 检查原绘本是否存在
    original_storybook = await get_storybook(storybook_id)
    if not original_storybook:
        # 返回错误的SSE格式响应
        async def error_generator():
            error_event = json.dumps({
                "type": "error",
                "data": {
                    "error": "原绘本不存在"
                }
            }, ensure_ascii=False)
            yield f"data: {error_event}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(
            error_generator(),
            media_type="text/event-stream"
        )

    async def event_generator():
        try:
            async for event in edit_storybook_stream(
                storybook_id=storybook_id,
                instruction=req.instruction,
                images=req.images
            ):
                # 使用 SSE 格式发送事件
                yield f"data: {event}\n\n"

            # 发送结束事件
            yield "data: [DONE]\n\n"
        except Exception as e:
            # 发送错误事件
            import json
            error_event = json.dumps({
                "type": "error",
                "data": {
                    "error": str(e)
                }
            }, ensure_ascii=False)
            yield f"data: {error_event}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


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
    """
    获取绘本列表

    支持按创建者筛选、按标题模糊匹配、按状态筛选、按是否公开筛选,以及分页查询。
    """
    storybooks = await list_storybooks_service(
        creator=creator,
        title=title,
        status=status,
        is_public=is_public,
        limit=limit,
        offset=offset
    )

    # 转换为响应格式（处理 datetime 和 pages）
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
    """
    获取绘本详情

    根据绘本ID获取完整的绘本信息，包括所有页面内容。
    """
    storybook = await get_storybook(storybook_id)

    if not storybook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="绘本不存在"
        )

    return storybook


@router.patch("/{storybook_id}/pages/{page_index}", response_model=StorybookResponse)
async def edit_storybook_page_endpoint(
    storybook_id: int,
    page_index: int,
    req: EditStorybookPageRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    编辑绘本单页

    根据编辑指令重新生成指定页面的内容。
    """
    # 检查绘本是否存在
    storybook = await get_storybook(storybook_id)
    if not storybook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="绘本不存在"
        )

    # 检查页码是否有效
    if not storybook.pages or page_index < 0 or page_index >= len(storybook.pages):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"无效的页码: {page_index}"
        )

    try:
        success = await edit_storybook_page(
            storybook_id=storybook_id,
            page_index=page_index,
            instruction=req.instruction
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="编辑页面失败"
            )

        # 返回更新后的绘本
        updated_storybook = await get_storybook(storybook_id)
        return updated_storybook

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"编辑页面时发生错误: {str(e)}"
        )


@router.delete("/{storybook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_storybook_endpoint(
    storybook_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    删除绘本

    根据绘本ID删除绘本。
    """
    from sqlalchemy import select, delete

    # 检查绘本是否存在
    storybook = await get_storybook(storybook_id)
    if not storybook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="绘本不存在"
        )

    try:
        # 删除绘本
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
    db: AsyncSession = Depends(get_db)
):
    """
    更新绘本公开状态

    设置绘本为公开或私密。
    """
    from sqlalchemy import select

    # 检查绘本是否存在
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
        # 更新公开状态
        storybook.is_public = req.is_public
        await db.commit()

        return {"message": "公开状态已更新", "is_public": req.is_public}

    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新公开状态时发生错误: {str(e)}"
        )
