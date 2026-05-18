from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field

from app.model.book import BookAccessLevel, BookLanguage, BookPublishStatus


class BookSort(StrEnum):
    FEATURED = "featured"
    NEWEST = "newest"
    POPULAR = "popular"


class BookSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    subtitle: str | None = None
    summary: str | None = None
    cover_url: str | None = None
    age_range_codes: list[str] = Field(default_factory=list)
    theme_codes: list[str] = Field(default_factory=list)
    education_goal_codes: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    language: BookLanguage
    reading_level: str | None = None
    page_count: int
    duration_seconds: int
    access_level: BookAccessLevel
    play_count: int
    favorite_count: int


class BookDetailRead(BookSummary):
    source_story_id: int | None = None
    narrative_style_code: str | None = None
    art_style_code: str | None = None
    publish_status: BookPublishStatus
    is_featured: bool
    created_at: datetime
    updated_at: datetime
    related_books: list[BookSummary] = Field(default_factory=list)


class BookListRead(BaseModel):
    items: list[BookSummary]
    total: int
    limit: int
    offset: int


class BookSimilarCreationRequest(BaseModel):
    profile_id: int | None = None
    note: str | None = Field(default=None, max_length=500)


class SimilarCreationSessionRead(BaseModel):
    session_id: int | None = None
    source_book_id: int
    source_title: str
    prefilled_theme_codes: list[str] = Field(default_factory=list)
    prefilled_age_range_codes: list[str] = Field(default_factory=list)
    prefilled_education_goal_codes: list[str] = Field(default_factory=list)
    prefilled_page_count: int
    prefilled_art_style_code: str | None = None
    guidance: str
