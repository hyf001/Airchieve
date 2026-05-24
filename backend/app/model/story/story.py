from enum import StrEnum

from sqlalchemy import Enum, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.model.base import Base, TimestampMixin


class StorySourceType(StrEnum):
    SYSTEM = "system"
    USER = "user"
    UPLOADED = "uploaded"
    GENERATED_IDEA = "generated_idea"


class StoryLanguage(StrEnum):
    ZH = "zh"
    EN = "en"
    BILINGUAL = "bilingual"


class StoryAccessLevel(StrEnum):
    FREE = "free"
    PREVIEW = "preview"
    VIP = "vip"


class StoryModerationStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    HIDDEN = "hidden"


class StoryPublishStatus(StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"
    UNPUBLISHED = "unpublished"
    DELETED = "deleted"


class Story(TimestampMixin, Base):
    __tablename__ = "stories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    source_type: Mapped[StorySourceType] = mapped_column(
        Enum(StorySourceType),
        nullable=False,
        default=StorySourceType.USER,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    body: Mapped[str] = mapped_column(Text, nullable=False)
    cover_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    age_range_codes: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    theme_codes: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    education_goal_codes: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    language: Mapped[StoryLanguage] = mapped_column(Enum(StoryLanguage), nullable=False, default=StoryLanguage.ZH)
    narrative_style_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    access_level: Mapped[StoryAccessLevel] = mapped_column(
        Enum(StoryAccessLevel),
        nullable=False,
        default=StoryAccessLevel.FREE,
        index=True,
    )
    moderation_status: Mapped[StoryModerationStatus] = mapped_column(
        Enum(StoryModerationStatus),
        nullable=False,
        default=StoryModerationStatus.APPROVED,
        index=True,
    )
    publish_status: Mapped[StoryPublishStatus] = mapped_column(
        Enum(StoryPublishStatus),
        nullable=False,
        default=StoryPublishStatus.DRAFT,
        index=True,
    )
    view_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
