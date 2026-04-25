"""
Image Style Service
图片风格服务
"""
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import asc, desc, func, select
from sqlalchemy.orm import selectinload

from app.db.session import async_session_maker
from app.models.image_style import ImageStyle, ImageStyleReferenceImage, ImageStyleVersion


class ImageStyleNotFoundError(Exception):
    """图片风格不存在"""


class ImageStyleVersionNotFoundError(Exception):
    """图片风格版本不存在"""


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

    url: str
    is_cover: bool = False
    sort_order: int = 0
    note: Optional[str] = None


def _is_blank(value: Optional[str]) -> bool:
    return value is None or not value.strip()


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
            .options(selectinload(ImageStyleVersion.reference_images))
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


async def get_style_version_for_generation(version_id: int) -> ImageStyleVersion:
    """读取绘本已锁定的画风版本，包含参考图。"""
    async with async_session_maker() as session:
        version = (
            await session.execute(
                select(ImageStyleVersion)
                .options(selectinload(ImageStyleVersion.reference_images))
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

        if name is not UNSET:
            style.name = name
        if description is not UNSET:
            style.description = description
        if cover_image is not UNSET:
            style.cover_image = cover_image
        if tags is not UNSET:
            style.tags = tags
        if is_active is not UNSET:
            style.is_active = is_active
        if sort_order is not UNSET:
            style.sort_order = sort_order
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

        for image in reference_images or []:
            session.add(
                ImageStyleReferenceImage(
                    image_style_version_id=version.id,
                    url=image.url,
                    is_cover=image.is_cover,
                    sort_order=image.sort_order,
                    note=image.note,
                    creator=creator,
                )
            )

        await session.commit()
        version = (
            await session.execute(select(ImageStyleVersion).where(ImageStyleVersion.id == version.id))
        ).scalar_one()
        return version


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
                .where(ImageStyleVersion.id == version_id)
                .where(ImageStyleVersion.image_style_id == style_id)
            )
        ).scalar_one_or_none()
        if version is None:
            raise ImageStyleVersionNotFoundError("画风版本不存在")

        reference_image_count = (
            await session.execute(
                select(func.count(ImageStyleReferenceImage.id)).where(
                    ImageStyleReferenceImage.image_style_version_id == version_id
                )
            )
        ).scalar_one()

        validate_style_version_complete(version, reference_image_count)
        version.status = "published"
        version.published_at = datetime.now(timezone.utc)
        style.current_version_id = version.id

        await session.commit()
        await session.refresh(version)
        return version


async def create_reference_image(
    style_id: int,
    version_id: int,
    creator: str,
    url: str,
    is_cover: bool = False,
    sort_order: int = 0,
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
            url=url,
            is_cover=is_cover,
            sort_order=sort_order,
            note=note,
            creator=creator,
        )
        session.add(image)
        await session.commit()
        await session.refresh(image)
        return image


async def update_reference_image(
    style_id: int,
    version_id: int,
    image_id: int,
    url: Optional[str] | UnsetValue = UNSET,
    is_cover: Optional[bool] | UnsetValue = UNSET,
    sort_order: Optional[int] | UnsetValue = UNSET,
    note: Optional[str] | UnsetValue = UNSET,
) -> ImageStyleReferenceImage:
    """更新图片风格版本参考图"""
    async with async_session_maker() as session:
        version = (
            await session.execute(
                select(ImageStyleVersion.id)
                .where(ImageStyleVersion.id == version_id)
                .where(ImageStyleVersion.image_style_id == style_id)
            )
        ).scalar_one_or_none()
        if version is None:
            raise ImageStyleVersionNotFoundError("画风版本不存在")

        image = (
            await session.execute(
                select(ImageStyleReferenceImage)
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

        if url is not UNSET:
            image.url = url
        if is_cover is not UNSET:
            image.is_cover = bool(is_cover)
        if sort_order is not UNSET:
            image.sort_order = sort_order
        if note is not UNSET:
            image.note = note

        await session.commit()
        await session.refresh(image)
        return image


async def delete_reference_image(style_id: int, version_id: int, image_id: int) -> bool:
    """删除图片风格版本参考图"""
    from sqlalchemy import delete

    async with async_session_maker() as session:
        version = (
            await session.execute(
                select(ImageStyleVersion.id)
                .where(ImageStyleVersion.id == version_id)
                .where(ImageStyleVersion.image_style_id == style_id)
            )
        ).scalar_one_or_none()
        if version is None:
            raise ImageStyleVersionNotFoundError("画风版本不存在")

        image = (
            await session.execute(
                select(ImageStyleReferenceImage.id)
                .where(ImageStyleReferenceImage.id == image_id)
                .where(ImageStyleReferenceImage.image_style_version_id == version_id)
            )
        ).scalar_one_or_none()
        if image is None:
            raise ImageStyleReferenceImageNotFoundError("画风参考图不存在")

        await session.execute(
            delete(ImageStyleReferenceImage).where(ImageStyleReferenceImage.id == image_id)
        )
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
            .where(ImageStyleVersion.id == style.current_version_id)
            .where(ImageStyleVersion.status == "published")
        )
        return result.scalar_one_or_none()
