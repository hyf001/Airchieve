from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.model.base import Base, TimestampMixin


class RecommendationPage(StrEnum):
    HOME = "home"
    CATEGORY = "category"
    BOOK_DETAIL = "book_detail"
    PLAYER_END = "player_end"
    CREATION_ENTRY = "creation_entry"


class RecommendationDisplayType(StrEnum):
    CAROUSEL = "carousel"
    GRID = "grid"
    LIST = "list"
    TOPIC = "topic"


class RecommendationStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class RecommendationTargetType(StrEnum):
    BOOK = "book"
    STORY = "story"
    TEMPLATE = "template"
    ART_STYLE = "art_style"
    CHARACTER = "character"
    VOICE = "voice"
    TOPIC = "topic"


class RecommendationAccessFilter(StrEnum):
    ALL = "all"
    FREE = "free"
    VIP = "vip"


class RecommendationTopicType(StrEnum):
    FESTIVAL = "festival"
    NEW_BOOKS = "new_books"
    EMOTION = "emotion"
    CULTURE = "culture"
    CUSTOM = "custom"


class RecommendationTopicStatus(StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"
    UNPUBLISHED = "unpublished"


class RecommendationSlot(TimestampMixin, Base):
    __tablename__ = "recommendation_slots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(80), nullable=False, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    page: Mapped[RecommendationPage] = mapped_column(Enum(RecommendationPage), nullable=False, index=True)
    display_type: Mapped[RecommendationDisplayType] = mapped_column(Enum(RecommendationDisplayType), nullable=False)
    rule_config: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)
    status: Mapped[RecommendationStatus] = mapped_column(
        Enum(RecommendationStatus),
        nullable=False,
        default=RecommendationStatus.ACTIVE,
        index=True,
    )

    items: Mapped[list["RecommendationItem"]] = relationship(
        back_populates="slot",
        cascade="all, delete-orphan",
        order_by="RecommendationItem.sort_weight.desc()",
    )


class RecommendationItem(TimestampMixin, Base):
    __tablename__ = "recommendation_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    slot_id: Mapped[int] = mapped_column(ForeignKey("recommendation_slots.id"), nullable=False, index=True)
    target_type: Mapped[RecommendationTargetType] = mapped_column(Enum(RecommendationTargetType), nullable=False)
    target_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    title_override: Mapped[str | None] = mapped_column(String(160), nullable=True)
    image_asset_id_override: Mapped[str | None] = mapped_column(String(120), nullable=True)
    scene_ids: Mapped[list[int]] = mapped_column(JSON, nullable=False, default=list)
    min_age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    access_level_filter: Mapped[RecommendationAccessFilter] = mapped_column(
        Enum(RecommendationAccessFilter),
        nullable=False,
        default=RecommendationAccessFilter.ALL,
    )
    sort_weight: Mapped[int] = mapped_column(Integer, nullable=False, default=0, index=True)
    start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[RecommendationStatus] = mapped_column(
        Enum(RecommendationStatus),
        nullable=False,
        default=RecommendationStatus.ACTIVE,
        index=True,
    )

    slot: Mapped[RecommendationSlot] = relationship(back_populates="items")


class RecommendationTopic(TimestampMixin, Base):
    __tablename__ = "recommendation_topics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_asset_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cover_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    topic_type: Mapped[RecommendationTopicType] = mapped_column(Enum(RecommendationTopicType), nullable=False)
    status: Mapped[RecommendationTopicStatus] = mapped_column(
        Enum(RecommendationTopicStatus),
        nullable=False,
        default=RecommendationTopicStatus.DRAFT,
        index=True,
    )
    sort_weight: Mapped[int] = mapped_column(Integer, nullable=False, default=0, index=True)
