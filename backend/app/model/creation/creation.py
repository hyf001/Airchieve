from enum import StrEnum

from sqlalchemy import Enum, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.model.base import Base, TimestampMixin


class CreationType(StrEnum):
    STORY_TO_BOOK = "story_to_book"
    TEMPLATE_BOOK = "template_book"
    SIMILAR_BOOK = "similar_book"


class CreationSessionStatus(StrEnum):
    DRAFT = "draft"
    GENERATING = "generating"
    PREVIEW = "preview"
    SAVED = "saved"
    FAILED = "failed"
    CANCELED = "canceled"


class CreationStep(StrEnum):
    STORY = "story"
    TEMPLATE = "template"
    CHARACTER = "character"
    ART_STYLE = "art_style"
    STORYBOARD = "storyboard"
    VOICE = "voice"
    LIP_SYNC = "lip_sync"
    PREVIEW = "preview"


class CreationStorySourceType(StrEnum):
    SYSTEM_STORY = "system_story"
    USER_STORY = "user_story"
    UPLOADED_STORY = "uploaded_story"
    IDEA = "idea"


class CreationLanguage(StrEnum):
    ZH = "zh"
    EN = "en"
    BILINGUAL = "bilingual"


class PageDraftTaskStatus(StrEnum):
    DRAFT = "draft"
    PENDING = "pending"
    READY = "ready"
    FAILED = "failed"
    SKIPPED = "skipped"


class CreationSession(TimestampMixin, Base):
    __tablename__ = "creation_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    child_profile_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    creation_type: Mapped[CreationType] = mapped_column(Enum(CreationType), nullable=False, index=True)
    status: Mapped[CreationSessionStatus] = mapped_column(
        Enum(CreationSessionStatus),
        nullable=False,
        default=CreationSessionStatus.DRAFT,
        index=True,
    )
    current_step: Mapped[CreationStep] = mapped_column(Enum(CreationStep), nullable=False, default=CreationStep.STORY)
    story_source_type: Mapped[CreationStorySourceType | None] = mapped_column(Enum(CreationStorySourceType), nullable=True)
    story_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    template_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    idea_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    reference_book_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    language: Mapped[CreationLanguage] = mapped_column(Enum(CreationLanguage), nullable=False, default=CreationLanguage.ZH)
    target_page_count: Mapped[int] = mapped_column(Integer, nullable=False, default=8)
    age_range_codes: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    theme_codes: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    education_goal_codes: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    narrative_style_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    character_refs: Mapped[list[dict]] = mapped_column(JSON, nullable=False, default=list)
    art_style_ref: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    voice_ref: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    quota_reservation_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    saved_book_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    page_drafts: Mapped[list["CreationPageDraft"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="CreationPageDraft.page_no",
    )


class CreationPageDraft(TimestampMixin, Base):
    __tablename__ = "creation_page_drafts"
    __table_args__ = (UniqueConstraint("session_id", "page_no", name="uq_creation_page_drafts_session_page_no"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("creation_sessions.id"), nullable=False, index=True)
    page_no: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str | None] = mapped_column(String(160), nullable=True)
    text_zh: Mapped[str | None] = mapped_column(Text, nullable=True)
    text_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    narration_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    visual_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    character_appearances: Mapped[list[dict]] = mapped_column(JSON, nullable=False, default=list)
    dialogues: Mapped[list[dict]] = mapped_column(JSON, nullable=False, default=list)
    voice_config: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    subtitle_config: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    lip_sync_config: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    image_asset_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    audio_asset_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    audio_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    lip_sync_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    storyboard_status: Mapped[PageDraftTaskStatus] = mapped_column(
        Enum(PageDraftTaskStatus),
        nullable=False,
        default=PageDraftTaskStatus.DRAFT,
    )
    image_status: Mapped[PageDraftTaskStatus] = mapped_column(
        Enum(PageDraftTaskStatus),
        nullable=False,
        default=PageDraftTaskStatus.DRAFT,
    )
    audio_status: Mapped[PageDraftTaskStatus] = mapped_column(
        Enum(PageDraftTaskStatus),
        nullable=False,
        default=PageDraftTaskStatus.DRAFT,
    )
    lip_sync_status: Mapped[PageDraftTaskStatus] = mapped_column(
        Enum(PageDraftTaskStatus),
        nullable=False,
        default=PageDraftTaskStatus.DRAFT,
    )

    session: Mapped[CreationSession] = relationship(back_populates="page_drafts")
