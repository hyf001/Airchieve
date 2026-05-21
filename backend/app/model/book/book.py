from enum import StrEnum

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

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


class BookSourceType(StrEnum):
    SYSTEM = "system"
    GENERATED = "generated"
    TEMPLATE_RESULT = "template_result"
    ADMIN = "admin"


class BookModerationStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    HIDDEN = "hidden"


class BookLipSyncStatus(StrEnum):
    NONE = "none"
    PENDING = "pending"
    READY = "ready"
    FAILED = "failed"


class BookPromptType(StrEnum):
    QUESTION = "question"
    INTERACTION = "interaction"


class BookContentStatus(StrEnum):
    VISIBLE = "visible"
    HIDDEN = "hidden"


class Book(TimestampMixin, Base):
    __tablename__ = "books"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    source_type: Mapped[BookSourceType] = mapped_column(
        Enum(BookSourceType),
        nullable=False,
        default=BookSourceType.SYSTEM,
        index=True,
    )
    source_story_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    subtitle: Mapped[str | None] = mapped_column(String(240), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_asset_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cover_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    age_range_codes: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    theme_codes: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    education_goal_codes: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    tags: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    language: Mapped[BookLanguage] = mapped_column(Enum(BookLanguage), nullable=False, default=BookLanguage.ZH)
    reading_level: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    narrative_style_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    art_style_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    custom_art_style_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    default_voice_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    default_voice_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
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
    moderation_status: Mapped[BookModerationStatus] = mapped_column(
        Enum(BookModerationStatus),
        nullable=False,
        default=BookModerationStatus.APPROVED,
        index=True,
    )
    preview_page_count: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    is_featured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    play_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    favorite_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    pages: Mapped[list["BookPage"]] = relationship(
        back_populates="book",
        cascade="all, delete-orphan",
        order_by="BookPage.page_no",
    )
    reading_prompts: Mapped[list["BookReadingPrompt"]] = relationship(
        back_populates="book",
        cascade="all, delete-orphan",
        order_by="BookReadingPrompt.sort_order",
    )
    learning_cards: Mapped[list["BookLearningCard"]] = relationship(
        back_populates="book",
        cascade="all, delete-orphan",
        order_by="BookLearningCard.sort_order",
    )


class BookPage(TimestampMixin, Base):
    __tablename__ = "book_pages"
    __table_args__ = (UniqueConstraint("book_id", "page_no", name="uq_book_pages_book_page_no"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    book_id: Mapped[int] = mapped_column(ForeignKey("books.id"), nullable=False, index=True)
    page_no: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str | None] = mapped_column(String(160), nullable=True)
    text_zh: Mapped[str | None] = mapped_column(Text, nullable=True)
    text_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    narration_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    visual_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_asset_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    video_asset_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    video_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    audio_asset_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    audio_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    background_music_asset_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    background_music_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    sound_effect_asset_ids: Mapped[list[int]] = mapped_column(JSON, nullable=False, default=list)
    sound_effect_urls: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    lip_sync_status: Mapped[BookLipSyncStatus] = mapped_column(
        Enum(BookLipSyncStatus),
        nullable=False,
        default=BookLipSyncStatus.NONE,
    )

    book: Mapped[Book] = relationship(back_populates="pages")
    dialogues: Mapped[list["BookDialogue"]] = relationship(
        back_populates="page",
        cascade="all, delete-orphan",
        order_by="BookDialogue.sort_order",
    )


class BookDialogue(Base):
    __tablename__ = "book_dialogues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    page_id: Mapped[int] = mapped_column(ForeignKey("book_pages.id"), nullable=False, index=True)
    character_ref: Mapped[str] = mapped_column(String(120), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    audio_asset_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    audio_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    end_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    lip_sync_asset_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    lip_sync_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    page: Mapped[BookPage] = relationship(back_populates="dialogues")


class BookReadingPrompt(TimestampMixin, Base):
    __tablename__ = "book_reading_prompts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    book_id: Mapped[int] = mapped_column(ForeignKey("books.id"), nullable=False, index=True)
    prompt_type: Mapped[BookPromptType] = mapped_column(Enum(BookPromptType), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    page_no: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[BookContentStatus] = mapped_column(
        Enum(BookContentStatus),
        nullable=False,
        default=BookContentStatus.VISIBLE,
        index=True,
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    book: Mapped[Book] = relationship(back_populates="reading_prompts")


class BookLearningCard(TimestampMixin, Base):
    __tablename__ = "book_learning_cards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    book_id: Mapped[int] = mapped_column(ForeignKey("books.id"), nullable=False, index=True)
    theme: Mapped[str | None] = mapped_column(String(120), nullable=True)
    education_goals: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    vocabulary: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    discussion_questions: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    status: Mapped[BookContentStatus] = mapped_column(
        Enum(BookContentStatus),
        nullable=False,
        default=BookContentStatus.VISIBLE,
        index=True,
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    book: Mapped[Book] = relationship(back_populates="learning_cards")
