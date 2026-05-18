from datetime import datetime, timezone
from enum import StrEnum

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, JSON, Numeric, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.model.base import Base, TimestampMixin
from app.model.book import Book


class ReadingMode(StrEnum):
    AUTO = "auto"
    MANUAL = "manual"
    PARENT_CHILD = "parent_child"


class ReadingTextMode(StrEnum):
    ZH = "zh"
    EN = "en"
    BILINGUAL = "bilingual"


class ReadingFavoriteStatus(StrEnum):
    ACTIVE = "active"
    DELETED = "deleted"


class ReadingEventType(StrEnum):
    PLAY_START = "play_start"
    PAGE_VIEW = "page_view"
    PAUSE = "pause"
    RESUME = "resume"
    COMPLETE = "complete"
    REPLAY = "replay"


class ReadingProgress(TimestampMixin, Base):
    __tablename__ = "reading_progress"
    __table_args__ = (UniqueConstraint("user_id", "child_profile_id", "book_id", name="uq_reading_progress_scope"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    child_profile_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    book_id: Mapped[int] = mapped_column(ForeignKey("books.id"), nullable=False, index=True)
    current_page_no: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    current_position_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    progress_percent: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    mode: Mapped[ReadingMode] = mapped_column(Enum(ReadingMode), nullable=False, default=ReadingMode.AUTO)
    text_mode: Mapped[ReadingTextMode] = mapped_column(Enum(ReadingTextMode), nullable=False, default=ReadingTextMode.ZH)
    voice_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_read_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    book: Mapped[Book] = relationship()


class ReadingFavorite(TimestampMixin, Base):
    __tablename__ = "reading_favorites"
    __table_args__ = (UniqueConstraint("user_id", "child_profile_id", "book_id", name="uq_reading_favorites_scope"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    child_profile_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    book_id: Mapped[int] = mapped_column(ForeignKey("books.id"), nullable=False, index=True)
    status: Mapped[ReadingFavoriteStatus] = mapped_column(
        Enum(ReadingFavoriteStatus),
        nullable=False,
        default=ReadingFavoriteStatus.ACTIVE,
        index=True,
    )

    book: Mapped[Book] = relationship()


Index(
    "uq_reading_progress_user_book_no_profile",
    ReadingProgress.user_id,
    ReadingProgress.book_id,
    unique=True,
    sqlite_where=ReadingProgress.child_profile_id.is_(None),
    postgresql_where=ReadingProgress.child_profile_id.is_(None),
)

Index(
    "uq_reading_favorites_user_book_no_profile",
    ReadingFavorite.user_id,
    ReadingFavorite.book_id,
    unique=True,
    sqlite_where=ReadingFavorite.child_profile_id.is_(None),
    postgresql_where=ReadingFavorite.child_profile_id.is_(None),
)


class ReadingEvent(Base):
    __tablename__ = "reading_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    child_profile_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    book_id: Mapped[int] = mapped_column(ForeignKey("books.id"), nullable=False, index=True)
    event_type: Mapped[ReadingEventType] = mapped_column(Enum(ReadingEventType), nullable=False, index=True)
    page_no: Mapped[int | None] = mapped_column(Integer, nullable=True)
    position_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    payload: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    book: Mapped[Book] = relationship()
