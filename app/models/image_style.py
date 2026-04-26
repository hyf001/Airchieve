"""
Image Style Models
图片风格模型 - 用于维护 AI 图片生成的视觉风格资产
"""
from datetime import datetime, timezone
from typing import Literal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


__all__ = [
    "ImageStyle",
    "ImageStyleAsset",
    "ImageStyleVersion",
    "ImageStyleReferenceImage",
    "ImageStyleVersionStatus",
]


ImageStyleVersionStatus = Literal["draft", "published"]


class ImageStyle(Base):
    """图片风格表"""
    __tablename__ = "image_styles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_image: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)

    current_version_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    creator: Mapped[str] = mapped_column(String(128), nullable=False)
    modifier: Mapped[str | None] = mapped_column(String(128), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    versions: Mapped[list["ImageStyleVersion"]] = relationship(
        "ImageStyleVersion",
        back_populates="image_style",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class ImageStyleAsset(Base):
    """图片风格素材库资产表"""
    __tablename__ = "image_style_assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    object_key: Mapped[str] = mapped_column(String(1024), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    tags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    style_type: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    color_tags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    texture_tags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    scene_tags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    subject_tags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    composition_tags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    age_group_tags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)

    content_type: Mapped[str] = mapped_column(String(128), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)

    creator: Mapped[str] = mapped_column(String(128), nullable=False)
    modifier: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    reference_images: Mapped[list["ImageStyleReferenceImage"]] = relationship(
        "ImageStyleReferenceImage",
        back_populates="asset",
        lazy="noload",
    )


class ImageStyleVersion(Base):
    """图片风格版本表"""
    __tablename__ = "image_style_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    image_style_id: Mapped[int] = mapped_column(
        ForeignKey("image_styles.id"), nullable=False, index=True
    )

    version_no: Mapped[str] = mapped_column(String(32), nullable=False)
    style_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    style_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    generation_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    negative_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[ImageStyleVersionStatus] = mapped_column(
        String(32), default="draft", nullable=False, index=True
    )
    creator: Mapped[str] = mapped_column(String(128), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    image_style: Mapped[ImageStyle] = relationship("ImageStyle", back_populates="versions")
    reference_images: Mapped[list["ImageStyleReferenceImage"]] = relationship(
        "ImageStyleReferenceImage",
        back_populates="version",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="ImageStyleReferenceImage.sort_order",
    )


class ImageStyleReferenceImage(Base):
    """图片风格版本参考图表"""
    __tablename__ = "image_style_reference_images"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    image_style_version_id: Mapped[int] = mapped_column(
        ForeignKey("image_style_versions.id"), nullable=False, index=True
    )

    asset_id: Mapped[int | None] = mapped_column(
        ForeignKey("image_style_assets.id"), nullable=True, index=True
    )
    url_snapshot: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    legacy_url: Mapped[str | None] = mapped_column("url", String(2048), nullable=True)
    is_cover: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)

    creator: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    version: Mapped[ImageStyleVersion] = relationship(
        "ImageStyleVersion", back_populates="reference_images"
    )
    asset: Mapped[ImageStyleAsset | None] = relationship(
        "ImageStyleAsset", back_populates="reference_images"
    )

    @property
    def url(self) -> str:
        """统一给旧生成链路和响应层使用的参考图 URL。"""
        if self.url_snapshot:
            return self.url_snapshot
        if self.asset is not None:
            return self.asset.url
        return self.legacy_url or ""
