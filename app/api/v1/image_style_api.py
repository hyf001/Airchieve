"""
Image Style API
图片风格接口
"""
from datetime import datetime
from io import BytesIO
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from PIL import Image, UnidentifiedImageError

from app.api.deps import get_current_user
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.image_style import (
    CreateImageStyleRequest,
    CreateImageStyleVersionRequest,
    ImageStyleAssetResponse,
    ImageStyleAssetUpdate,
    ImageStyleListItem,
    ReferenceImageCreate,
    ReferenceImageResponse,
    ReferenceImageUpdate,
    ImageStyleResponse,
    ImageStyleVersionResponse,
    UpdateImageStyleRequest,
    UpdateImageStyleVersionRequest,
)
from app.services import oss_service
from app.services.image_style_service import (
    ImageStyleAssetInUseError,
    ImageStyleAssetNotFoundError,
    ImageStyleNotFoundError,
    ImageStyleReferenceImageNotFoundError,
    ImageStyleVersionImmutableError,
    ImageStyleVersionNotFoundError,
    IncompleteImageStyleVersionError,
    ReferenceImageInput,
    UNSET,
    create_image_style_asset,
    create_image_style,
    create_reference_image,
    create_style_version,
    delete_image_style_asset,
    delete_reference_image,
    delete_style_version,
    get_image_style_asset,
    get_image_style,
    list_admin_image_styles,
    list_image_style_assets,
    list_image_styles,
    list_style_versions,
    publish_style_version,
    update_image_style_asset,
    update_reference_image,
    update_image_style,
    update_style_version,
)


router = APIRouter(prefix="/image-styles", tags=["image-styles"])
asset_router = APIRouter(prefix="/image-style-assets", tags=["image-style-assets"])

ALLOWED_ASSET_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp"}
MAX_ASSET_SIZE = 10 * 1024 * 1024


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
        current_version_id=version.id if version else None,
        current_version_no=version.version_no if version else None,
        is_active=style.is_active,
        sort_order=style.sort_order,
        updated_at=style.updated_at,
    )


def _asset_response(asset, reference_count: int = 0) -> ImageStyleAssetResponse:
    return ImageStyleAssetResponse(
        id=asset.id,
        url=asset.url,
        object_key=asset.object_key,
        name=asset.name,
        description=asset.description,
        tags=asset.tags or [],
        style_type=asset.style_type,
        color_tags=asset.color_tags or [],
        texture_tags=asset.texture_tags or [],
        scene_tags=asset.scene_tags or [],
        subject_tags=asset.subject_tags or [],
        composition_tags=asset.composition_tags or [],
        age_group_tags=asset.age_group_tags or [],
        content_type=asset.content_type,
        file_size=asset.file_size,
        width=asset.width,
        height=asset.height,
        is_active=asset.is_active,
        reference_count=reference_count,
        creator=asset.creator,
        modifier=asset.modifier,
        created_at=asset.created_at,
        updated_at=asset.updated_at,
    )


def _reference_response(image) -> ReferenceImageResponse:
    return ReferenceImageResponse(
        id=image.id,
        image_style_version_id=image.image_style_version_id,
        asset_id=image.asset_id,
        url=image.url,
        url_snapshot=image.url_snapshot,
        is_cover=image.is_cover,
        sort_order=image.sort_order,
        note=image.note,
        creator=image.creator,
        created_at=image.created_at,
        updated_at=image.updated_at,
    )


def _version_response(version) -> ImageStyleVersionResponse:
    return ImageStyleVersionResponse(
        id=version.id,
        image_style_id=version.image_style_id,
        version_no=version.version_no,
        generation_prompt=version.generation_prompt,
        negative_prompt=version.negative_prompt,
        reference_images=[_reference_response(image) for image in version.reference_images],
        status=version.status,
        creator=version.creator,
        created_at=version.created_at,
        published_at=version.published_at,
    )


def _parse_form_list(values: Optional[list[str]]) -> list[str]:
    if not values:
        return []
    items: list[str] = []
    for value in values:
        items.extend([item.strip() for item in value.split(",") if item.strip()])
    return items


@asset_router.post("/upload", response_model=ImageStyleAssetResponse, status_code=status.HTTP_201_CREATED)
async def upload_image_style_asset_endpoint(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    tags: Optional[list[str]] = Form(None),
    style_type: Optional[str] = Form(None),
    color_tags: Optional[list[str]] = Form(None),
    texture_tags: Optional[list[str]] = Form(None),
    scene_tags: Optional[list[str]] = Form(None),
    subject_tags: Optional[list[str]] = Form(None),
    composition_tags: Optional[list[str]] = Form(None),
    age_group_tags: Optional[list[str]] = Form(None),
    current_user: User = Depends(require_image_style_admin),
):
    """上传图片到 OSS，并创建风格图片资产。"""
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type not in ALLOWED_ASSET_CONTENT_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="只支持 PNG、JPEG 或 WebP 图片")

    data = await file.read()
    if len(data) > MAX_ASSET_SIZE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="图片大小不能超过 10MB")

    width: Optional[int] = None
    height: Optional[int] = None
    try:
        with Image.open(BytesIO(data)) as image:
            width, height = image.size
    except UnidentifiedImageError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无法识别图片文件")

    ext = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}[content_type]
    now = datetime.now()
    object_key = f"image-style-assets/{now:%Y}/{now:%m}/{uuid4().hex}.{ext}"
    url = await oss_service.upload_bytes(data, object_key, content_type)
    asset = await create_image_style_asset(
        url=url,
        object_key=object_key,
        name=name or file.filename or "未命名图片",
        description=description,
        tags=_parse_form_list(tags),
        style_type=style_type,
        color_tags=_parse_form_list(color_tags),
        texture_tags=_parse_form_list(texture_tags),
        scene_tags=_parse_form_list(scene_tags),
        subject_tags=_parse_form_list(subject_tags),
        composition_tags=_parse_form_list(composition_tags),
        age_group_tags=_parse_form_list(age_group_tags),
        content_type=content_type,
        file_size=len(data),
        width=width,
        height=height,
        creator=_user_label(current_user),
    )
    return _asset_response(asset)


@asset_router.get("", response_model=list[ImageStyleAssetResponse])
async def list_image_style_assets_endpoint(
    is_active: Optional[bool] = Query(None, description="是否启用"),
    style_type: Optional[str] = Query(None, description="风格类型"),
    tag: Optional[str] = Query(None, description="标签"),
    limit: int = Query(100, ge=1, le=100, description="返回数量限制"),
    offset: int = Query(0, ge=0, description="偏移量"),
    _current_user: User = Depends(require_image_style_admin),
):
    """获取风格图片资产列表"""
    items = await list_image_style_assets(
        is_active=is_active,
        style_type=style_type,
        tag=tag,
        limit=limit,
        offset=offset,
    )
    return [_asset_response(asset, count) for asset, count in items]


@asset_router.get("/{asset_id}", response_model=ImageStyleAssetResponse)
async def get_image_style_asset_endpoint(
    asset_id: int,
    _current_user: User = Depends(require_image_style_admin),
):
    """获取风格图片资产详情"""
    try:
        asset, reference_count = await get_image_style_asset(asset_id)
    except ImageStyleAssetNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="图片资产不存在")
    return _asset_response(asset, reference_count)


@asset_router.put("/{asset_id}", response_model=ImageStyleAssetResponse)
async def update_image_style_asset_endpoint(
    asset_id: int,
    req: ImageStyleAssetUpdate,
    current_user: User = Depends(require_image_style_admin),
):
    """更新风格图片资产元信息"""
    fields = req.model_fields_set
    try:
        asset = await update_image_style_asset(
            asset_id=asset_id,
            modifier=_user_label(current_user),
            name=req.name if "name" in fields else UNSET,
            description=req.description if "description" in fields else UNSET,
            tags=req.tags if "tags" in fields else UNSET,
            style_type=req.style_type if "style_type" in fields else UNSET,
            color_tags=req.color_tags if "color_tags" in fields else UNSET,
            texture_tags=req.texture_tags if "texture_tags" in fields else UNSET,
            scene_tags=req.scene_tags if "scene_tags" in fields else UNSET,
            subject_tags=req.subject_tags if "subject_tags" in fields else UNSET,
            composition_tags=req.composition_tags if "composition_tags" in fields else UNSET,
            age_group_tags=req.age_group_tags if "age_group_tags" in fields else UNSET,
            is_active=req.is_active if "is_active" in fields else UNSET,
        )
    except ImageStyleAssetNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="图片资产不存在")
    _, reference_count = await get_image_style_asset(asset_id)
    return _asset_response(asset, reference_count)


@asset_router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_image_style_asset_endpoint(
    asset_id: int,
    _current_user: User = Depends(require_image_style_admin),
):
    """删除未被引用的风格图片资产"""
    try:
        await delete_image_style_asset(asset_id)
        return None
    except ImageStyleAssetNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="图片资产不存在")
    except ImageStyleAssetInUseError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.get("", response_model=list[ImageStyleListItem])
async def list_image_styles_endpoint(
    is_active: Optional[bool] = Query(True, description="是否启用"),
    limit: int = Query(100, ge=1, le=100, description="返回数量限制"),
    offset: int = Query(0, ge=0, description="偏移量"),
):
    """获取可用图片风格列表"""
    items = await list_image_styles(is_active=is_active, limit=limit, offset=offset)
    return [_style_list_item(style, version) for style, version in items]


@router.get("/admin", response_model=list[ImageStyleListItem])
async def list_admin_image_styles_endpoint(
    is_active: Optional[bool] = Query(None, description="是否启用"),
    limit: int = Query(100, ge=1, le=100, description="返回数量限制"),
    offset: int = Query(0, ge=0, description="偏移量"),
    _current_user: User = Depends(require_image_style_admin),
):
    """管理员获取全部图片风格"""
    items = await list_admin_image_styles(is_active=is_active, limit=limit, offset=offset)
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
        version = await create_style_version(
            style_id=style_id,
            generation_prompt=req.generation_prompt,
            negative_prompt=req.negative_prompt,
            reference_images=[
                ReferenceImageInput(
                    asset_id=item.asset_id,
                    is_cover=item.is_cover,
                    sort_order=item.sort_order,
                    note=item.note,
                )
                for item in req.reference_images
            ],
            creator=_user_label(current_user),
        )
        return _version_response(version)
    except ImageStyleNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="画风不存在")
    except ImageStyleAssetNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="图片资产不存在")


@router.get("/{style_id}/versions", response_model=list[ImageStyleVersionResponse])
async def list_style_versions_endpoint(
    style_id: int,
    _current_user: User = Depends(require_image_style_admin),
):
    """获取图片风格版本列表"""
    try:
        return [_version_response(version) for version in await list_style_versions(style_id)]
    except ImageStyleNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="画风不存在")


@router.put("/{style_id}/versions/{version_id}", response_model=ImageStyleVersionResponse)
async def update_style_version_endpoint(
    style_id: int,
    version_id: int,
    req: UpdateImageStyleVersionRequest,
    _current_user: User = Depends(require_image_style_admin),
):
    """更新图片风格版本草稿"""
    fields = req.model_fields_set
    try:
        version = await update_style_version(
            style_id=style_id,
            version_id=version_id,
            generation_prompt=req.generation_prompt if "generation_prompt" in fields else UNSET,
            negative_prompt=req.negative_prompt if "negative_prompt" in fields else UNSET,
        )
        return _version_response(version)
    except ImageStyleVersionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="画风版本不存在")
    except ImageStyleVersionImmutableError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.delete("/{style_id}/versions/{version_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_style_version_endpoint(
    style_id: int,
    version_id: int,
    _current_user: User = Depends(require_image_style_admin),
):
    """删除图片风格草稿版本"""
    try:
        await delete_style_version(style_id, version_id)
        return None
    except ImageStyleVersionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="画风版本不存在")
    except ImageStyleVersionImmutableError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


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
        image = await create_reference_image(
            style_id=style_id,
            version_id=version_id,
            asset_id=req.asset_id,
            is_cover=req.is_cover,
            sort_order=req.sort_order,
            note=req.note,
            creator=_user_label(current_user),
        )
        return _reference_response(image)
    except ImageStyleVersionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="画风版本不存在")
    except ImageStyleAssetNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="图片资产不存在")
    except ImageStyleVersionImmutableError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


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
        image = await update_reference_image(
            style_id=style_id,
            version_id=version_id,
            image_id=image_id,
            is_cover=req.is_cover if "is_cover" in update_fields else UNSET,
            sort_order=req.sort_order if "sort_order" in update_fields else UNSET,
            note=req.note if "note" in update_fields else UNSET,
        )
        return _reference_response(image)
    except ImageStyleVersionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="画风版本不存在")
    except ImageStyleReferenceImageNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="画风参考图不存在")
    except ImageStyleVersionImmutableError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


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
    except ImageStyleVersionImmutableError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


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
        return _version_response(await publish_style_version(style_id, version_id))
    except ImageStyleNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="画风不存在")
    except ImageStyleVersionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="画风版本不存在")
    except IncompleteImageStyleVersionError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="画风配置不完整")
