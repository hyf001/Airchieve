"""
Image Style Service
图片风格服务
"""
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import asc, desc, exists, func, or_, select
from sqlalchemy.orm import selectinload

from app.db.session import async_session_maker
from app.models.image_style import (
    ImageStyle,
    ImageStyleAsset,
    ImageStyleReferenceImage,
    ImageStyleVersion,
)


class ImageStyleNotFoundError(Exception):
    """图片风格不存在"""


class ImageStyleAssetNotFoundError(Exception):
    """图片风格资产不存在"""


class ImageStyleAssetInUseError(Exception):
    """图片风格资产已被引用"""


class ImageStyleVersionNotFoundError(Exception):
    """图片风格版本不存在"""


class ImageStyleVersionImmutableError(Exception):
    """已发布图片风格版本不可变"""


class ImageStyleReferenceImageNotFoundError(Exception):
    """图片风格参考图不存在"""


class ImageStyleUnavailableError(Exception):
    """图片风格当前不可用"""


class IncompleteImageStyleVersionError(Exception):
    """图片风格版本配置不完整"""


class UnsetValue:
    """用于区分“未传字段”和“显式传 None”的哨兵值。"""


UNSET = UnsetValue()


@dataclass(frozen=True)
class ReferenceImageInput:
    """创建风格版本时携带的初始参考图。"""

    asset_id: int
    is_cover: bool = False
    sort_order: Optional[int] = None
    note: Optional[str] = None


def _is_blank(value: Optional[str]) -> bool:
    return value is None or not value.strip()


def _ensure_draft(version: ImageStyleVersion, detail: str) -> None:
    if version.status != "draft":
        raise ImageStyleVersionImmutableError(detail)


def _json_array_contains(column, value: str):
    items = func.json_each(column).table_valued("value")
    return exists(select(1).select_from(items).where(items.c.value == value))


def validate_style_version_complete(
    version: ImageStyleVersion,
    reference_image_count: Optional[int] = None,
) -> None:
    """发布前校验风格版本配置是否完整"""
    image_count = (
        reference_image_count
        if reference_image_count is not None
        else len(version.reference_images)
    )
    if (
        _is_blank(version.style_summary)
        or _is_blank(version.style_description)
        or _is_blank(version.generation_prompt)
        or _is_blank(version.negative_prompt)
        or image_count <= 0
    ):
        raise IncompleteImageStyleVersionError("画风配置不完整")


async def _load_version_with_reference_assets(session, version_id: int) -> ImageStyleVersion:
    version = (
        await session.execute(
            select(ImageStyleVersion)
            .options(
                selectinload(ImageStyleVersion.reference_images).selectinload(
                    ImageStyleReferenceImage.asset
                )
            )
            .where(ImageStyleVersion.id == version_id)
        )
    ).scalar_one()
    return version


async def list_image_style_assets(
    is_active: Optional[bool] = None,
    style_type: Optional[str] = None,
    tag: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> list[tuple[ImageStyleAsset, int]]:
    """获取风格图片资产列表"""
    async with async_session_maker() as session:
        ref_count = func.count(ImageStyleReferenceImage.id).label("reference_count")
        query = (
            select(ImageStyleAsset, ref_count)
            .outerjoin(ImageStyleReferenceImage, ImageStyleReferenceImage.asset_id == ImageStyleAsset.id)
            .group_by(ImageStyleAsset.id)
            .order_by(desc(ImageStyleAsset.created_at))
        )
        if is_active is not None:
            query = query.where(ImageStyleAsset.is_active.is_(is_active))
        if style_type:
            query = query.where(ImageStyleAsset.style_type == style_type)
        if tag:
            query = query.where(
                or_(
                    _json_array_contains(ImageStyleAsset.tags, tag),
                    _json_array_contains(ImageStyleAsset.color_tags, tag),
                    _json_array_contains(ImageStyleAsset.texture_tags, tag),
                    _json_array_contains(ImageStyleAsset.scene_tags, tag),
                    _json_array_contains(ImageStyleAsset.subject_tags, tag),
                    _json_array_contains(ImageStyleAsset.composition_tags, tag),
                    _json_array_contains(ImageStyleAsset.age_group_tags, tag),
                )
            )
        query = query.limit(limit).offset(offset)

        result = await session.execute(query)
        return list(result.all())


async def get_image_style_asset(asset_id: int) -> tuple[ImageStyleAsset, int]:
    """获取风格图片资产详情"""
    async with async_session_maker() as session:
        asset = (
            await session.execute(select(ImageStyleAsset).where(ImageStyleAsset.id == asset_id))
        ).scalar_one_or_none()
        if asset is None:
            raise ImageStyleAssetNotFoundError("图片资产不存在")
        count = (
            await session.execute(
                select(func.count(ImageStyleReferenceImage.id)).where(
                    ImageStyleReferenceImage.asset_id == asset_id
                )
            )
        ).scalar_one()
        return asset, count


async def create_image_style_asset(
    *,
    url: str,
    object_key: str,
    name: str,
    content_type: str,
    file_size: int,
    creator: str,
    width: Optional[int] = None,
    height: Optional[int] = None,
    description: Optional[str] = None,
    tags: Optional[list[str]] = None,
    style_type: Optional[str] = None,
    color_tags: Optional[list[str]] = None,
    texture_tags: Optional[list[str]] = None,
    scene_tags: Optional[list[str]] = None,
    subject_tags: Optional[list[str]] = None,
    composition_tags: Optional[list[str]] = None,
    age_group_tags: Optional[list[str]] = None,
) -> ImageStyleAsset:
    """创建风格图片资产"""
    async with async_session_maker() as session:
        asset = ImageStyleAsset(
            url=url,
            object_key=object_key,
            name=name,
            description=description,
            tags=tags or [],
            style_type=style_type,
            color_tags=color_tags or [],
            texture_tags=texture_tags or [],
            scene_tags=scene_tags or [],
            subject_tags=subject_tags or [],
            composition_tags=composition_tags or [],
            age_group_tags=age_group_tags or [],
            content_type=content_type,
            file_size=file_size,
            width=width,
            height=height,
            creator=creator,
        )
        session.add(asset)
        await session.commit()
        await session.refresh(asset)
        return asset


async def update_image_style_asset(
    asset_id: int,
    modifier: str,
    name: Optional[str] | UnsetValue = UNSET,
    description: Optional[str] | UnsetValue = UNSET,
    tags: Optional[list[str]] | UnsetValue = UNSET,
    style_type: Optional[str] | UnsetValue = UNSET,
    color_tags: Optional[list[str]] | UnsetValue = UNSET,
    texture_tags: Optional[list[str]] | UnsetValue = UNSET,
    scene_tags: Optional[list[str]] | UnsetValue = UNSET,
    subject_tags: Optional[list[str]] | UnsetValue = UNSET,
    composition_tags: Optional[list[str]] | UnsetValue = UNSET,
    age_group_tags: Optional[list[str]] | UnsetValue = UNSET,
    is_active: Optional[bool] | UnsetValue = UNSET,
) -> ImageStyleAsset:
    """更新风格图片资产元信息"""
    async with async_session_maker() as session:
        asset = (
            await session.execute(select(ImageStyleAsset).where(ImageStyleAsset.id == asset_id))
        ).scalar_one_or_none()
        if asset is None:
            raise ImageStyleAssetNotFoundError("图片资产不存在")

        for field_name, value in (
            ("name", name),
            ("description", description),
            ("tags", tags),
            ("style_type", style_type),
            ("color_tags", color_tags),
            ("texture_tags", texture_tags),
            ("scene_tags", scene_tags),
            ("subject_tags", subject_tags),
            ("composition_tags", composition_tags),
            ("age_group_tags", age_group_tags),
            ("is_active", is_active),
        ):
            if value is not UNSET:
                setattr(asset, field_name, value)
        asset.modifier = modifier

        await session.commit()
        await session.refresh(asset)
        return asset


async def delete_image_style_asset(asset_id: int) -> None:
    """删除未被引用的风格图片资产"""
    from sqlalchemy import delete

    async with async_session_maker() as session:
        asset = (
            await session.execute(select(ImageStyleAsset).where(ImageStyleAsset.id == asset_id))
        ).scalar_one_or_none()
        if asset is None:
            raise ImageStyleAssetNotFoundError("图片资产不存在")
        count = (
            await session.execute(
                select(func.count(ImageStyleReferenceImage.id)).where(
                    ImageStyleReferenceImage.asset_id == asset_id
                )
            )
        ).scalar_one()
        if count > 0:
            raise ImageStyleAssetInUseError("图片资产已被风格版本引用，只能下架")
        await session.execute(delete(ImageStyleAsset).where(ImageStyleAsset.id == asset_id))
        await session.commit()


async def list_image_styles(
    is_active: Optional[bool] = True,
    limit: int = 100,
    offset: int = 0,
) -> list[tuple[ImageStyle, ImageStyleVersion]]:
    """获取普通用户可用的图片风格列表"""
    if is_active is False:
        return []

    async with async_session_maker() as session:
        query = (
            select(ImageStyle, ImageStyleVersion)
            .join(ImageStyleVersion, ImageStyle.current_version_id == ImageStyleVersion.id)
            .where(ImageStyle.current_version_id.is_not(None))
            .where(ImageStyle.is_active.is_(True))
            .where(ImageStyleVersion.status == "published")
            .order_by(asc(ImageStyle.sort_order), desc(ImageStyle.created_at))
            .limit(limit)
            .offset(offset)
        )

        result = await session.execute(query)
        return list(result.all())


async def list_admin_image_styles(
    is_active: Optional[bool] = None,
    limit: int = 100,
    offset: int = 0,
) -> list[tuple[ImageStyle, Optional[ImageStyleVersion]]]:
    """管理员获取全部图片风格，包括未发布和停用风格。"""
    async with async_session_maker() as session:
        query = (
            select(ImageStyle, ImageStyleVersion)
            .outerjoin(ImageStyleVersion, ImageStyle.current_version_id == ImageStyleVersion.id)
            .order_by(asc(ImageStyle.sort_order), desc(ImageStyle.updated_at))
            .limit(limit)
            .offset(offset)
        )
        if is_active is not None:
            query = query.where(ImageStyle.is_active.is_(is_active))
        result = await session.execute(query)
        return list(result.all())


async def get_image_style(style_id: int) -> tuple[ImageStyle, ImageStyleVersion]:
    """获取普通用户可用的图片风格详情"""
    async with async_session_maker() as session:
        result = await session.execute(
            select(ImageStyle, ImageStyleVersion)
            .join(ImageStyleVersion, ImageStyle.current_version_id == ImageStyleVersion.id)
            .where(ImageStyle.id == style_id)
            .where(ImageStyle.is_active.is_(True))
            .where(ImageStyleVersion.status == "published")
        )
        item = result.one_or_none()
        if item is None:
            raise ImageStyleNotFoundError("画风不存在")
        return item


async def validate_style_available(style_id: int) -> tuple[ImageStyle, ImageStyleVersion]:
    """校验图片风格可用于绘本生成，并返回当前已发布版本。"""
    async with async_session_maker() as session:
        result = await session.execute(
            select(ImageStyle, ImageStyleVersion)
            .join(ImageStyleVersion, ImageStyle.current_version_id == ImageStyleVersion.id)
            .options(
                selectinload(ImageStyleVersion.reference_images).selectinload(
                    ImageStyleReferenceImage.asset
                )
            )
            .where(ImageStyle.id == style_id)
            .where(ImageStyle.is_active.is_(True))
            .where(ImageStyleVersion.status == "published")
        )
        item = result.one_or_none()
        if item is None:
            raise ImageStyleUnavailableError("该画风已停用，请重新选择画风")

        _style, version = item
        try:
            validate_style_version_complete(version)
        except IncompleteImageStyleVersionError as exc:
            raise ImageStyleUnavailableError("画风配置不完整，请联系管理员检查画风配置") from exc
        return item


async def get_reference_image_urls(version_id: int) -> list[str]:
    """统一读取版本参考图 URL。"""
    async with async_session_maker() as session:
        result = await session.execute(
            select(ImageStyleReferenceImage)
            .options(selectinload(ImageStyleReferenceImage.asset))
            .where(ImageStyleReferenceImage.image_style_version_id == version_id)
            .order_by(asc(ImageStyleReferenceImage.sort_order), asc(ImageStyleReferenceImage.id))
        )
        return [url for image in result.scalars().all() if (url := image.url)]


async def get_style_version_for_generation(version_id: int) -> ImageStyleVersion:
    """读取绘本已锁定的画风版本，包含参考图。"""
    async with async_session_maker() as session:
        version = (
            await session.execute(
                select(ImageStyleVersion)
                .options(
                    selectinload(ImageStyleVersion.reference_images).selectinload(
                        ImageStyleReferenceImage.asset
                    )
                )
                .where(ImageStyleVersion.id == version_id)
                .where(ImageStyleVersion.status == "published")
            )
        ).scalar_one_or_none()
        if version is None:
            raise ImageStyleVersionNotFoundError("画风版本不存在")
        try:
            validate_style_version_complete(version)
        except IncompleteImageStyleVersionError as exc:
            raise ImageStyleUnavailableError("画风参考图不可用，请联系管理员检查画风配置") from exc
        return version


async def get_image_style_for_admin(style_id: int) -> ImageStyle:
    """管理员获取图片风格，不限制启停状态"""
    async with async_session_maker() as session:
        result = await session.execute(select(ImageStyle).where(ImageStyle.id == style_id))
        style = result.scalar_one_or_none()
        if style is None:
            raise ImageStyleNotFoundError("画风不存在")
        return style


async def create_image_style(
    name: str,
    creator: str,
    description: Optional[str] = None,
    cover_image: Optional[str] = None,
    tags: Optional[list[str]] = None,
    is_active: bool = True,
    sort_order: int = 0,
) -> ImageStyle:
    """创建图片风格"""
    async with async_session_maker() as session:
        style = ImageStyle(
            name=name,
            description=description,
            cover_image=cover_image,
            tags=tags or [],
            creator=creator,
            is_active=is_active,
            sort_order=sort_order,
        )
        session.add(style)
        await session.commit()
        await session.refresh(style)
        return style


async def update_image_style(
    style_id: int,
    modifier: str,
    name: Optional[str] | UnsetValue = UNSET,
    description: Optional[str] | UnsetValue = UNSET,
    cover_image: Optional[str] | UnsetValue = UNSET,
    tags: Optional[list[str]] | UnsetValue = UNSET,
    is_active: Optional[bool] | UnsetValue = UNSET,
    sort_order: Optional[int] | UnsetValue = UNSET,
) -> ImageStyle:
    """更新图片风格基础信息"""
    async with async_session_maker() as session:
        result = await session.execute(select(ImageStyle).where(ImageStyle.id == style_id))
        style = result.scalar_one_or_none()
        if style is None:
            raise ImageStyleNotFoundError("画风不存在")

        for field_name, value in (
            ("name", name),
            ("description", description),
            ("cover_image", cover_image),
            ("tags", tags),
            ("is_active", is_active),
            ("sort_order", sort_order),
        ):
            if value is not UNSET:
                setattr(style, field_name, value)
        style.modifier = modifier

        await session.commit()
        await session.refresh(style)
        return style


async def create_style_version(
    style_id: int,
    creator: str,
    style_summary: Optional[str] = None,
    style_description: Optional[str] = None,
    generation_prompt: Optional[str] = None,
    negative_prompt: Optional[str] = None,
    reference_images: Optional[list[ReferenceImageInput]] = None,
) -> ImageStyleVersion:
    """创建图片风格版本草稿"""
    async with async_session_maker() as session:
        style = (
            await session.execute(select(ImageStyle).where(ImageStyle.id == style_id))
        ).scalar_one_or_none()
        if style is None:
            raise ImageStyleNotFoundError("画风不存在")

        version_count = (
            await session.execute(
                select(func.count(ImageStyleVersion.id)).where(
                    ImageStyleVersion.image_style_id == style_id
                )
            )
        ).scalar_one()

        version = ImageStyleVersion(
            image_style_id=style_id,
            version_no=f"v{version_count + 1}",
            style_summary=style_summary,
            style_description=style_description,
            generation_prompt=generation_prompt,
            negative_prompt=negative_prompt,
            status="draft",
            creator=creator,
        )
        session.add(version)
        await session.flush()

        for index, image in enumerate(reference_images or []):
            asset = (
                await session.execute(select(ImageStyleAsset).where(ImageStyleAsset.id == image.asset_id))
            ).scalar_one_or_none()
            if asset is None:
                raise ImageStyleAssetNotFoundError("图片资产不存在")
            session.add(
                ImageStyleReferenceImage(
                    image_style_version_id=version.id,
                    asset_id=asset.id,
                    legacy_url=asset.url,
                    is_cover=image.is_cover,
                    sort_order=image.sort_order if image.sort_order is not None else index,
                    note=image.note,
                    creator=creator,
                )
            )

        await session.commit()
        return await _load_version_with_reference_assets(session, version.id)


async def update_style_version(
    style_id: int,
    version_id: int,
    style_summary: Optional[str] | UnsetValue = UNSET,
    style_description: Optional[str] | UnsetValue = UNSET,
    generation_prompt: Optional[str] | UnsetValue = UNSET,
    negative_prompt: Optional[str] | UnsetValue = UNSET,
) -> ImageStyleVersion:
    """更新图片风格草稿版本"""
    async with async_session_maker() as session:
        version = (
            await session.execute(
                select(ImageStyleVersion)
                .options(
                    selectinload(ImageStyleVersion.reference_images).selectinload(
                        ImageStyleReferenceImage.asset
                    )
                )
                .where(ImageStyleVersion.id == version_id)
                .where(ImageStyleVersion.image_style_id == style_id)
            )
        ).scalar_one_or_none()
        if version is None:
            raise ImageStyleVersionNotFoundError("画风版本不存在")
        _ensure_draft(version, "已发布版本不可编辑，请创建新版本")

        for field_name, value in (
            ("style_summary", style_summary),
            ("style_description", style_description),
            ("generation_prompt", generation_prompt),
            ("negative_prompt", negative_prompt),
        ):
            if value is not UNSET:
                setattr(version, field_name, value)
        await session.commit()
        return await _load_version_with_reference_assets(session, version_id)


async def delete_style_version(style_id: int, version_id: int) -> None:
    """删除草稿版本和其参考图引用"""
    from sqlalchemy import delete

    async with async_session_maker() as session:
        version = (
            await session.execute(
                select(ImageStyleVersion)
                .where(ImageStyleVersion.id == version_id)
                .where(ImageStyleVersion.image_style_id == style_id)
            )
        ).scalar_one_or_none()
        if version is None:
            raise ImageStyleVersionNotFoundError("画风版本不存在")
        _ensure_draft(version, "已发布版本不可删除，请创建新版本")

        await session.execute(
            delete(ImageStyleReferenceImage).where(
                ImageStyleReferenceImage.image_style_version_id == version_id
            )
        )
        await session.execute(delete(ImageStyleVersion).where(ImageStyleVersion.id == version_id))
        await session.commit()


async def list_style_versions(style_id: int) -> list[ImageStyleVersion]:
    """获取图片风格版本列表"""
    async with async_session_maker() as session:
        style = (
            await session.execute(select(ImageStyle.id).where(ImageStyle.id == style_id))
        ).scalar_one_or_none()
        if style is None:
            raise ImageStyleNotFoundError("画风不存在")

        result = await session.execute(
            select(ImageStyleVersion)
            .options(
                selectinload(ImageStyleVersion.reference_images).selectinload(
                    ImageStyleReferenceImage.asset
                )
            )
            .where(ImageStyleVersion.image_style_id == style_id)
            .order_by(desc(ImageStyleVersion.created_at))
        )
        return list(result.scalars().all())


async def publish_style_version(style_id: int, version_id: int) -> ImageStyleVersion:
    """发布图片风格版本，并更新当前生效版本"""
    async with async_session_maker() as session:
        style = (
            await session.execute(select(ImageStyle).where(ImageStyle.id == style_id))
        ).scalar_one_or_none()
        if style is None:
            raise ImageStyleNotFoundError("画风不存在")

        version = (
            await session.execute(
                select(ImageStyleVersion)
                .options(
                    selectinload(ImageStyleVersion.reference_images).selectinload(
                        ImageStyleReferenceImage.asset
                    )
                )
                .where(ImageStyleVersion.id == version_id)
                .where(ImageStyleVersion.image_style_id == style_id)
            )
        ).scalar_one_or_none()
        if version is None:
            raise ImageStyleVersionNotFoundError("画风版本不存在")

        validate_style_version_complete(version)
        sorted_images = sorted(version.reference_images, key=lambda item: (item.sort_order, item.id))
        if not sorted_images:
            raise IncompleteImageStyleVersionError("画风配置不完整")

        version.status = "published"
        version.published_at = datetime.now(timezone.utc)
        style.current_version_id = version.id

        cover_image = next((image for image in sorted_images if image.is_cover), None) or sorted_images[0]
        for image in sorted_images:
            image.url_snapshot = image.url
            image.is_cover = image.id == cover_image.id
        style.cover_image = cover_image.url

        await session.commit()
        return await _load_version_with_reference_assets(session, version_id)


async def create_reference_image(
    style_id: int,
    version_id: int,
    creator: str,
    asset_id: int,
    is_cover: bool = False,
    sort_order: Optional[int] = None,
    note: Optional[str] = None,
) -> ImageStyleReferenceImage:
    """新增图片风格版本参考图"""
    async with async_session_maker() as session:
        version = (
            await session.execute(
                select(ImageStyleVersion)
                .where(ImageStyleVersion.id == version_id)
                .where(ImageStyleVersion.image_style_id == style_id)
            )
        ).scalar_one_or_none()
        if version is None:
            raise ImageStyleVersionNotFoundError("画风版本不存在")
        _ensure_draft(version, "已发布版本的参考图不可修改，请创建新版本")

        asset = (
            await session.execute(select(ImageStyleAsset).where(ImageStyleAsset.id == asset_id))
        ).scalar_one_or_none()
        if asset is None:
            raise ImageStyleAssetNotFoundError("图片资产不存在")

        if sort_order is None:
            max_sort = (
                await session.execute(
                    select(func.max(ImageStyleReferenceImage.sort_order)).where(
                        ImageStyleReferenceImage.image_style_version_id == version_id
                    )
                )
            ).scalar_one()
            sort_order = (max_sort if max_sort is not None else -1) + 1

        if is_cover:
            images = (
                await session.execute(
                    select(ImageStyleReferenceImage).where(
                        ImageStyleReferenceImage.image_style_version_id == version_id
                    )
                )
            ).scalars().all()
            for image in images:
                image.is_cover = False

        image = ImageStyleReferenceImage(
            image_style_version_id=version_id,
            asset_id=asset_id,
            legacy_url=asset.url,
            is_cover=is_cover,
            sort_order=sort_order,
            note=note,
            creator=creator,
        )
        session.add(image)
        await session.commit()
        await session.refresh(image, attribute_names=["asset"])
        return image


async def update_reference_image(
    style_id: int,
    version_id: int,
    image_id: int,
    is_cover: Optional[bool] | UnsetValue = UNSET,
    sort_order: Optional[int] | UnsetValue = UNSET,
    note: Optional[str] | UnsetValue = UNSET,
) -> ImageStyleReferenceImage:
    """更新图片风格版本参考图"""
    async with async_session_maker() as session:
        version = (
            await session.execute(
                select(ImageStyleVersion)
                .where(ImageStyleVersion.id == version_id)
                .where(ImageStyleVersion.image_style_id == style_id)
            )
        ).scalar_one_or_none()
        if version is None:
            raise ImageStyleVersionNotFoundError("画风版本不存在")
        _ensure_draft(version, "已发布版本的参考图不可修改，请创建新版本")

        image = (
            await session.execute(
                select(ImageStyleReferenceImage)
                .options(selectinload(ImageStyleReferenceImage.asset))
                .where(ImageStyleReferenceImage.id == image_id)
                .where(ImageStyleReferenceImage.image_style_version_id == version_id)
            )
        ).scalar_one_or_none()
        if image is None:
            raise ImageStyleReferenceImageNotFoundError("画风参考图不存在")

        if is_cover is True:
            images = (
                await session.execute(
                    select(ImageStyleReferenceImage).where(
                        ImageStyleReferenceImage.image_style_version_id == version_id
                    )
                )
            ).scalars().all()
            for other in images:
                if other.id != image.id:
                    other.is_cover = False

        if is_cover is not UNSET:
            image.is_cover = bool(is_cover)
        if sort_order is not UNSET:
            image.sort_order = sort_order
        if note is not UNSET:
            image.note = note

        await session.commit()
        await session.refresh(image, attribute_names=["asset"])
        return image


async def delete_reference_image(style_id: int, version_id: int, image_id: int) -> bool:
    """删除图片风格版本参考图"""
    from sqlalchemy import delete

    async with async_session_maker() as session:
        version = (
            await session.execute(
                select(ImageStyleVersion)
                .where(ImageStyleVersion.id == version_id)
                .where(ImageStyleVersion.image_style_id == style_id)
            )
        ).scalar_one_or_none()
        if version is None:
            raise ImageStyleVersionNotFoundError("画风版本不存在")
        _ensure_draft(version, "已发布版本的参考图不可修改，请创建新版本")

        image = (
            await session.execute(
                select(ImageStyleReferenceImage)
                .where(ImageStyleReferenceImage.id == image_id)
                .where(ImageStyleReferenceImage.image_style_version_id == version_id)
            )
        ).scalar_one_or_none()
        if image is None:
            raise ImageStyleReferenceImageNotFoundError("画风参考图不存在")

        was_cover = image.is_cover
        await session.execute(
            delete(ImageStyleReferenceImage).where(ImageStyleReferenceImage.id == image_id)
        )
        await session.flush()

        if was_cover:
            next_cover = (
                await session.execute(
                    select(ImageStyleReferenceImage)
                    .where(ImageStyleReferenceImage.image_style_version_id == version_id)
                    .order_by(asc(ImageStyleReferenceImage.sort_order), asc(ImageStyleReferenceImage.id))
                    .limit(1)
                )
            ).scalar_one_or_none()
            if next_cover is not None:
                next_cover.is_cover = True

        await session.commit()
        return True


async def get_current_style_version(style_id: int) -> Optional[ImageStyleVersion]:
    """获取图片风格当前生效版本"""
    async with async_session_maker() as session:
        style = (
            await session.execute(select(ImageStyle).where(ImageStyle.id == style_id))
        ).scalar_one_or_none()
        if style is None or style.current_version_id is None:
            return None

        result = await session.execute(
            select(ImageStyleVersion)
            .options(
                selectinload(ImageStyleVersion.reference_images).selectinload(
                    ImageStyleReferenceImage.asset
                )
            )
            .where(ImageStyleVersion.id == style.current_version_id)
            .where(ImageStyleVersion.status == "published")
        )
        return result.scalar_one_or_none()
