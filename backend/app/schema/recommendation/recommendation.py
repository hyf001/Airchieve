from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.model.recommendation import (
    RecommendationAccessFilter,
    RecommendationDisplayType,
    RecommendationPage,
    RecommendationStatus,
    RecommendationTargetType,
    RecommendationTopicStatus,
    RecommendationTopicType,
)
from app.schema.book import BookSummary
from app.schema.story import StorySummary


class RecommendationTargetRead(BaseModel):
    target_type: RecommendationTargetType
    book: BookSummary | None = None
    story: StorySummary | None = None
    topic: "RecommendationTopicRead | None" = None


class RecommendationItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    target_type: RecommendationTargetType
    target_id: int
    title_override: str | None = None
    image_asset_id_override: str | None = None
    scene_codes: list[str] = Field(default_factory=list)
    min_age: int | None = None
    max_age: int | None = None
    access_level_filter: RecommendationAccessFilter
    sort_weight: int
    start_at: datetime | None = None
    end_at: datetime | None = None
    status: RecommendationStatus
    target: RecommendationTargetRead | None = None


class RecommendationSlotRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    page: RecommendationPage
    display_type: RecommendationDisplayType
    rule_config: dict[str, object] = Field(default_factory=dict)
    status: RecommendationStatus
    items: list[RecommendationItemRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class RecommendationTopicRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    summary: str | None = None
    cover_url: str | None = None
    topic_type: RecommendationTopicType
    status: RecommendationTopicStatus
    sort_weight: int
    created_at: datetime
    updated_at: datetime


class RecommendationHomeRead(BaseModel):
    slots: list[RecommendationSlotRead]


class RecommendationSlotCreate(BaseModel):
    code: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=120)
    page: RecommendationPage
    display_type: RecommendationDisplayType
    rule_config: dict[str, object] = Field(default_factory=dict)
    status: RecommendationStatus = RecommendationStatus.ACTIVE


class RecommendationSlotUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    page: RecommendationPage | None = None
    display_type: RecommendationDisplayType | None = None
    rule_config: dict[str, object] | None = None
    status: RecommendationStatus | None = None


class RecommendationItemWrite(BaseModel):
    target_type: RecommendationTargetType
    target_id: int
    title_override: str | None = Field(default=None, max_length=160)
    image_asset_id_override: str | None = Field(default=None, max_length=120)
    scene_codes: list[str] = Field(default_factory=list)
    min_age: int | None = Field(default=None, ge=0, le=18)
    max_age: int | None = Field(default=None, ge=0, le=18)
    access_level_filter: RecommendationAccessFilter = RecommendationAccessFilter.ALL
    sort_weight: int = 0
    start_at: datetime | None = None
    end_at: datetime | None = None
    status: RecommendationStatus = RecommendationStatus.ACTIVE


class RecommendationItemStatusUpdate(BaseModel):
    status: RecommendationStatus
