from datetime import datetime

from pydantic import BaseModel, Field

from app.model.reading import ReadingEventType, ReadingFavoriteStatus, ReadingMode, ReadingTextMode
from app.schema.book import BookSummary


class ReadingScopedRequest(BaseModel):
    child_profile_id: int | None = None


class FavoriteToggleRequest(ReadingScopedRequest):
    book_id: int
    desired_status: ReadingFavoriteStatus | None = None


class FavoriteRead(BaseModel):
    id: int
    book_id: int
    child_profile_id: int | None = None
    status: ReadingFavoriteStatus
    is_favorite: bool
    created_at: datetime
    updated_at: datetime


class ReadingProgressUpsert(ReadingScopedRequest):
    current_page_no: int = Field(ge=1)
    current_position_ms: int = Field(default=0, ge=0)
    progress_percent: float = Field(default=0, ge=0, le=100)
    mode: ReadingMode = ReadingMode.AUTO
    text_mode: ReadingTextMode = ReadingTextMode.ZH
    voice_id: int | None = None
    completed: bool = False


class ReadingProgressRead(BaseModel):
    id: int
    book_id: int
    child_profile_id: int | None = None
    current_page_no: int
    current_position_ms: int
    progress_percent: float
    mode: ReadingMode
    text_mode: ReadingTextMode
    voice_id: int | None = None
    last_read_at: datetime
    completed_at: datetime | None = None


class RecentReadSummary(BaseModel):
    progress: ReadingProgressRead
    book: BookSummary


class ReadingEventCreate(ReadingScopedRequest):
    book_id: int
    event_type: ReadingEventType
    page_no: int | None = Field(default=None, ge=1)
    position_ms: int | None = Field(default=None, ge=0)
    payload: dict[str, str | int | float | bool | None] = Field(default_factory=dict)
    occurred_at: datetime | None = None
