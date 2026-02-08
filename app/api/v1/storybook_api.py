"""
Storybook API
绘本接口 - 增删改查
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.storybook import Storybook, StorybookPage
from app.services.storybook_service import (
    create_storybook_stream,
    get_storybook,
    update_storybook_pages,
    edit_storybook,
    edit_storybook_page,
)

router = APIRouter(prefix="/storybooks", tags=["storybooks"])


# ============ Schemas ============
class CreateStorybookRequest(BaseModel):
    """创建绘本请求"""
    instruction: str = Field(..., min_length=1, max_length=1000, description="用户指令/绘本描述")
    style_prefix: str = Field(..., min_length=1, max_length=100, description="绘本风格")
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
    created_at: str

    class Config:
        from_attributes = True


class EditStorybookRequest(BaseModel):
    """编辑绘本请求"""
    instruction: str = Field(..., min_length=1, max_length=1000, description="编辑指令")


class EditStorybookPageRequest(BaseModel):
    """编辑绘本单页请求"""
    instruction: str = Field(..., min_length=1, max_length=1000, description="编辑指令")


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
                style_prefix=req.style_prefix,
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


@router.get("", response_model=List[StorybookListResponse])
async def list_storybooks(
    creator: Optional[str] = Query(None, description="按创建者筛选"),
    title: Optional[str] = Query(None, description="按标题模糊匹配"),
    status: Optional[str] = Query(None, description="按状态筛选"),
    limit: int = Query(20, ge=1, le=100, description="返回数量限制"),
    offset: int = Query(0, ge=0, description="偏移量"),
    db: AsyncSession = Depends(get_db)
):
    """
    获取绘本列表

    支持按创建者筛选、按标题模糊匹配、按状态筛选，以及分页查询。
    """
    from sqlalchemy import select, desc

    query = select(Storybook).order_by(desc(Storybook.created_at))

    # 筛选条件
    if creator:
        query = query.where(Storybook.creator == creator)
    if title:
        # 模糊匹配标题
        query = query.where(Storybook.title.like(f"%{title}%"))
    if status:
        query = query.where(Storybook.status == status)

    # 分页
    query = query.limit(limit).offset(offset)

    result = await db.execute(query)
    storybooks = result.scalars().all()

    # 转换为响应格式（处理 datetime）
    response_data = []
    for book in storybooks:
        response_data.append({
            "id": book.id,
            "title": book.title,
            "description": book.description,
            "creator": book.creator,
            "status": book.status,
            "created_at": book.created_at.isoformat() if book.created_at else ""
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


@router.put("/{storybook_id}", response_model=StorybookResponse)
async def edit_storybook_endpoint(
    storybook_id: int,
    req: EditStorybookRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    编辑绘本

    根据编辑指令对整个绘本进行重新生成。
    """
    # 检查绘本是否存在
    storybook = await get_storybook(storybook_id)
    if not storybook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="绘本不存在"
        )

    try:
        success = await edit_storybook(
            storybook_id=storybook_id,
            instruction=req.instruction
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="编辑绘本失败"
            )

        # 返回更新后的绘本
        updated_storybook = await get_storybook(storybook_id)
        return updated_storybook

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"编辑绘本时发生错误: {str(e)}"
        )


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
