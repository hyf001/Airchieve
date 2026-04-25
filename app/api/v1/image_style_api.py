"""
Image Style API
图片风格接口
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_user
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.image_style import (
    CreateImageStyleRequest,
    CreateImageStyleVersionRequest,
    ImageStyleListItem,
    ReferenceImageCreate,
    ReferenceImageResponse,
    ReferenceImageUpdate,
    ImageStyleResponse,
    ImageStyleVersionResponse,
    UpdateImageStyleRequest,
)
from app.services.image_style_service import (
    ImageStyleNotFoundError,
    ImageStyleReferenceImageNotFoundError,
    ImageStyleVersionNotFoundError,
    IncompleteImageStyleVersionError,
    ReferenceImageInput,
    UNSET,
    create_image_style,
    create_reference_image,
    create_style_version,
    delete_reference_image,
    get_image_style,
    list_image_styles,
    list_style_versions,
    publish_style_version,
    update_reference_image,
    update_image_style,
)


router = APIRouter(prefix="/image-styles", tags=["image-styles"])


def _user_label(user: User) -> str:
    return str(user.id)


async def require_image_style_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """图片风格管理权限校验"""
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权限操作图片风格",
        )
    return current_user


def _style_response(style, current_version_no: Optional[str] = None) -> ImageStyleResponse:
    return ImageStyleResponse(
        id=style.id,
        name=style.name,
        description=style.description,
        cover_image=style.cover_image,
        tags=style.tags or [],
        current_version_id=style.current_version_id,
        current_version_no=current_version_no,
        is_active=style.is_active,
        sort_order=style.sort_order,
        creator=style.creator,
        modifier=style.modifier,
        created_at=style.created_at,
        updated_at=style.updated_at,
    )


def _style_list_item(style, version) -> ImageStyleListItem:
    return ImageStyleListItem(
        id=style.id,
        name=style.name,
        description=style.description,
        cover_image=style.cover_image,
        tags=style.tags or [],
        current_version_id=version.id,
        current_version_no=version.version_no,
        sort_order=style.sort_order,
    )


@router.get("", response_model=list[ImageStyleListItem])
async def list_image_styles_endpoint(
    is_active: Optional[bool] = Query(True, description="是否启用"),
    limit: int = Query(100, ge=1, le=100, description="返回数量限制"),
    offset: int = Query(0, ge=0, description="偏移量"),
):
    """获取可用图片风格列表"""
    items = await list_image_styles(is_active=is_active, limit=limit, offset=offset)
    return [_style_list_item(style, version) for style, version in items]


@router.get("/{style_id}", response_model=ImageStyleResponse)
async def get_image_style_endpoint(style_id: int):
    """获取可用图片风格详情"""
    try:
        style, version = await get_image_style(style_id)
    except ImageStyleNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="画风不存在")
    return _style_response(style, version.version_no)


@router.post("", response_model=ImageStyleResponse, status_code=status.HTTP_201_CREATED)
async def create_image_style_endpoint(
    req: CreateImageStyleRequest,
    current_user: User = Depends(require_image_style_admin),
):
    """创建图片风格"""
    style = await create_image_style(
        name=req.name,
        description=req.description,
        cover_image=req.cover_image,
        tags=req.tags,
        creator=_user_label(current_user),
        is_active=req.is_active,
        sort_order=req.sort_order,
    )
    return _style_response(style)


@router.put("/{style_id}", response_model=ImageStyleResponse)
async def update_image_style_endpoint(
    style_id: int,
    req: UpdateImageStyleRequest,
    current_user: User = Depends(require_image_style_admin),
):
    """更新图片风格基础信息"""
    update_fields = req.model_fields_set

    try:
        style = await update_image_style(
            style_id=style_id,
            name=req.name if "name" in update_fields else UNSET,
            description=req.description if "description" in update_fields else UNSET,
            cover_image=req.cover_image if "cover_image" in update_fields else UNSET,
            tags=req.tags if "tags" in update_fields else UNSET,
            is_active=req.is_active if "is_active" in update_fields else UNSET,
            sort_order=req.sort_order if "sort_order" in update_fields else UNSET,
            modifier=_user_label(current_user),
        )
    except ImageStyleNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="画风不存在")
    return _style_response(style)


@router.post(
    "/{style_id}/versions",
    response_model=ImageStyleVersionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_style_version_endpoint(
    style_id: int,
    req: CreateImageStyleVersionRequest,
    current_user: User = Depends(require_image_style_admin),
):
    """创建图片风格版本草稿"""
    try:
        return await create_style_version(
            style_id=style_id,
            style_summary=req.style_summary,
            style_description=req.style_description,
            generation_prompt=req.generation_prompt,
            negative_prompt=req.negative_prompt,
            reference_images=[
                ReferenceImageInput(
                    url=item.url,
                    is_cover=item.is_cover,
                    sort_order=item.sort_order,
                    note=item.note,
                )
                for item in req.reference_images
            ],
            creator=_user_label(current_user),
        )
    except ImageStyleNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="画风不存在")


@router.get("/{style_id}/versions", response_model=list[ImageStyleVersionResponse])
async def list_style_versions_endpoint(
    style_id: int,
    _current_user: User = Depends(require_image_style_admin),
):
    """获取图片风格版本列表"""
    try:
        return await list_style_versions(style_id)
    except ImageStyleNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="画风不存在")


@router.post(
    "/{style_id}/versions/{version_id}/reference-images",
    response_model=ReferenceImageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_reference_image_endpoint(
    style_id: int,
    version_id: int,
    req: ReferenceImageCreate,
    current_user: User = Depends(require_image_style_admin),
):
    """新增图片风格版本参考图"""
    try:
        return await create_reference_image(
            style_id=style_id,
            version_id=version_id,
            url=req.url,
            is_cover=req.is_cover,
            sort_order=req.sort_order,
            note=req.note,
            creator=_user_label(current_user),
        )
    except ImageStyleVersionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="画风版本不存在")


@router.put(
    "/{style_id}/versions/{version_id}/reference-images/{image_id}",
    response_model=ReferenceImageResponse,
)
async def update_reference_image_endpoint(
    style_id: int,
    version_id: int,
    image_id: int,
    req: ReferenceImageUpdate,
    _current_user: User = Depends(require_image_style_admin),
):
    """更新图片风格版本参考图"""
    update_fields = req.model_fields_set
    try:
        return await update_reference_image(
            style_id=style_id,
            version_id=version_id,
            image_id=image_id,
            url=req.url if "url" in update_fields else UNSET,
            is_cover=req.is_cover if "is_cover" in update_fields else UNSET,
            sort_order=req.sort_order if "sort_order" in update_fields else UNSET,
            note=req.note if "note" in update_fields else UNSET,
        )
    except ImageStyleVersionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="画风版本不存在")
    except ImageStyleReferenceImageNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="画风参考图不存在")


@router.delete(
    "/{style_id}/versions/{version_id}/reference-images/{image_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_reference_image_endpoint(
    style_id: int,
    version_id: int,
    image_id: int,
    _current_user: User = Depends(require_image_style_admin),
):
    """删除图片风格版本参考图"""
    try:
        await delete_reference_image(style_id, version_id, image_id)
        return None
    except ImageStyleVersionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="画风版本不存在")
    except ImageStyleReferenceImageNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="画风参考图不存在")


@router.post(
    "/{style_id}/versions/{version_id}/publish",
    response_model=ImageStyleVersionResponse,
)
async def publish_style_version_endpoint(
    style_id: int,
    version_id: int,
    _current_user: User = Depends(require_image_style_admin),
):
    """发布图片风格版本"""
    try:
        return await publish_style_version(style_id, version_id)
    except ImageStyleNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="画风不存在")
    except ImageStyleVersionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="画风版本不存在")
    except IncompleteImageStyleVersionError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="画风配置不完整")
