"""
Template API
模版接口 - 增删改查
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.services.template_service import (
    create_template,
    get_template,
    list_templates,
    update_template,
    delete_template,
)

router = APIRouter(prefix="/templates", tags=["templates"])


# ============ Schemas ============
class CreateTemplateRequest(BaseModel):
    """创建模版请求"""
    name: str = Field(..., min_length=1, max_length=255, description="模版名称")
    instruction: str = Field(..., min_length=1, description="用户指令模板")
    creator: str = Field(..., max_length=128, description="创建者名称")
    description: Optional[str] = Field(None, description="模版描述")
    systemprompt: Optional[str] = Field(None, description="系统提示词")
    storybook_id: Optional[int] = Field(None, description="示例绘本ID")
    is_active: bool = Field(True, description="是否启用")
    sort_order: int = Field(0, description="排序顺序")


class UpdateTemplateRequest(BaseModel):
    """更新模版请求"""
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="模版名称")
    description: Optional[str] = Field(None, description="模版描述")
    instruction: Optional[str] = Field(None, min_length=1, description="用户指令模板")
    systemprompt: Optional[str] = Field(None, description="系统提示词")
    storybook_id: Optional[int] = Field(None, description="示例绘本ID")
    is_active: Optional[bool] = Field(None, description="是否启用")
    sort_order: Optional[int] = Field(None, description="排序顺序")
    modifier: Optional[str] = Field(None, max_length=128, description="修改者名称")


class TemplateResponse(BaseModel):
    """模版响应"""
    id: int
    name: str
    description: Optional[str]
    creator: str
    modifier: Optional[str]
    instruction: str
    systemprompt: Optional[str]
    storybook_id: Optional[int]
    is_active: bool
    sort_order: int
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class TemplateListResponse(BaseModel):
    """模版列表响应"""
    id: int
    name: str
    description: Optional[str]
    creator: str
    is_active: bool
    sort_order: int
    created_at: str

    class Config:
        from_attributes = True


# ============ Endpoints ============
@router.post("", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template_endpoint(
    req: CreateTemplateRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    创建模版

    创建一个新的绘本生成模版。
    """
    try:
        template = await create_template(
            name=req.name,
            instruction=req.instruction,
            creator=req.creator,
            description=req.description,
            systemprompt=req.systemprompt,
            storybook_id=req.storybook_id,
            is_active=req.is_active,
            sort_order=req.sort_order
        )

        # 转换为响应格式
        return {
            "id": template.id,
            "name": template.name,
            "description": template.description,
            "creator": template.creator,
            "modifier": template.modifier,
            "instruction": template.instruction,
            "systemprompt": template.systemprompt,
            "storybook_id": template.storybook_id,
            "is_active": template.is_active,
            "sort_order": template.sort_order,
            "created_at": template.created_at.isoformat() if template.created_at else "",
            "updated_at": template.updated_at.isoformat() if template.updated_at else ""
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建模版时发生错误: {str(e)}"
        )


@router.get("", response_model=List[TemplateListResponse])
async def list_templates_endpoint(
    creator: Optional[str] = Query(None, description="按创建者筛选"),
    is_active: Optional[bool] = Query(None, description="按启用状态筛选"),
    keyword: Optional[str] = Query(None, description="按名称或描述关键词筛选"),
    limit: int = Query(20, ge=1, le=100, description="返回数量限制"),
    offset: int = Query(0, ge=0, description="偏移量"),
    db: AsyncSession = Depends(get_db)
):
    """
    获取模版列表

    支持按创建者筛选、按启用状态筛选、按关键词筛选，以及分页查询。
    """
    templates = await list_templates(
        creator=creator,
        is_active=is_active,
        keyword=keyword,
        limit=limit,
        offset=offset
    )

    # 转换为响应格式
    response_data = []
    for template in templates:
        response_data.append({
            "id": template.id,
            "name": template.name,
            "description": template.description,
            "creator": template.creator,
            "is_active": template.is_active,
            "sort_order": template.sort_order,
            "created_at": template.created_at.isoformat() if template.created_at else ""
        })

    return response_data


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template_endpoint(
    template_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    获取模版详情

    根据模版ID获取完整的模版信息。
    """
    template = await get_template(template_id)

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="模版不存在"
        )

    # 转换为响应格式
    return {
        "id": template.id,
        "name": template.name,
        "description": template.description,
        "creator": template.creator,
        "modifier": template.modifier,
        "instruction": template.instruction,
        "systemprompt": template.systemprompt,
        "storybook_id": template.storybook_id,
        "is_active": template.is_active,
        "sort_order": template.sort_order,
        "created_at": template.created_at.isoformat() if template.created_at else "",
        "updated_at": template.updated_at.isoformat() if template.updated_at else ""
    }


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template_endpoint(
    template_id: int,
    req: UpdateTemplateRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    更新模版

    根据模版ID更新模版信息。
    """
    try:
        template = await update_template(
            template_id=template_id,
            name=req.name,
            description=req.description,
            instruction=req.instruction,
            systemprompt=req.systemprompt,
            storybook_id=req.storybook_id,
            is_active=req.is_active,
            sort_order=req.sort_order,
            modifier=req.modifier
        )

        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="模版不存在"
            )

        # 转换为响应格式
        return {
            "id": template.id,
            "name": template.name,
            "description": template.description,
            "creator": template.creator,
            "modifier": template.modifier,
            "instruction": template.instruction,
            "systemprompt": template.systemprompt,
            "storybook_id": template.storybook_id,
            "is_active": template.is_active,
            "sort_order": template.sort_order,
            "created_at": template.created_at.isoformat() if template.created_at else "",
            "updated_at": template.updated_at.isoformat() if template.updated_at else ""
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新模版时发生错误: {str(e)}"
        )


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template_endpoint(
    template_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    删除模版

    根据模版ID删除模版。
    """
    success = await delete_template(template_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="模版不存在"
        )

    return None
