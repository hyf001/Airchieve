from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.model.taxonomy import TaxonomyItemStatus, TaxonomyType


class TaxonomyItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: TaxonomyType
    code: str
    name: str
    name_en: str | None = None
    description: str | None = None
    metadata: dict | None = None
    sort_order: int
    status: TaxonomyItemStatus
    created_at: datetime
    updated_at: datetime


class TaxonomyItemCreate(BaseModel):
    type: TaxonomyType
    code: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=120)
    name_en: str | None = Field(default=None, max_length=120)
    description: str | None = None
    metadata: dict | None = None
    sort_order: int = 0


class TaxonomyItemUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=64)
    name: str | None = Field(default=None, min_length=1, max_length=120)
    name_en: str | None = Field(default=None, max_length=120)
    description: str | None = None
    metadata: dict | None = None
    sort_order: int | None = None


class TaxonomyItemStatusUpdate(BaseModel):
    status: TaxonomyItemStatus


class TaxonomyReorderItem(BaseModel):
    id: int
    sort_order: int


class TaxonomyReorderRequest(BaseModel):
    items: list[TaxonomyReorderItem]
