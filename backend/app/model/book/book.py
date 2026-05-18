from enum import StrEnum

from sqlalchemy import Boolean, Enum, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.model.base import Base, TimestampMixin


class BookLanguage(StrEnum):
    ZH = "zh"
    EN = "en"
    BILINGUAL = "bilingual"


class BookAccessLevel(StrEnum):
    FREE = "free"
    PREVIEW = "preview"
    VIP = "vip"


class BookPublishStatus(StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"
    UNPUBLISHED = "unpublished"
    DELETED = "deleted"


class Book(TimestampMixin, Base):
    __tablename__ = "books"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    source_story_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    subtitle: Mapped[str | None] = mapped_column(String(240), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_asset_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cover_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    age_range_codes: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    theme_codes: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    education_goal_codes: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    tags: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    language: Mapped[BookLanguage] = mapped_column(Enum(BookLanguage), nullable=False, default=BookLanguage.ZH)
    reading_level: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    narrative_style_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    art_style_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    page_count: Mapped[int] = mapped_column(Integer, nullable=False, default=8)
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=360)
    access_level: Mapped[BookAccessLevel] = mapped_column(
        Enum(BookAccessLevel),
        nullable=False,
        default=BookAccessLevel.FREE,
        index=True,
    )
    publish_status: Mapped[BookPublishStatus] = mapped_column(
        Enum(BookPublishStatus),
        nullable=False,
        default=BookPublishStatus.PUBLISHED,
        index=True,
    )
    is_featured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    play_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    favorite_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
