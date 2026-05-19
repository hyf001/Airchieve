from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.model.share import ShareAccessScope, ShareLinkStatus
from app.schema.book import BookPlayerOptions, BookPlayerPayload


class ShareLinkCreate(BaseModel):
    access_scope: ShareAccessScope = ShareAccessScope.PUBLIC
    password: str | None = Field(default=None, min_length=4, max_length=64)
    privacy_confirmation_id: int | None = None
    idempotency_key: str | None = Field(default=None, max_length=120)
    expires_at: datetime | None = None


class ShareLinkUpdate(BaseModel):
    access_scope: ShareAccessScope | None = None
    password: str | None = Field(default=None, min_length=4, max_length=64)
    status: ShareLinkStatus | None = None
    expires_at: datetime | None = None


class ShareLinkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    book_id: int
    title_snapshot: str
    cover_url_snapshot: str | None = None
    access_scope: ShareAccessScope
    status: ShareLinkStatus
    privacy_confirmation_id: int | None = None
    expires_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    token: str | None = None
    public_url: str | None = None
    access_count: int = 0


class ShareLinkListRead(BaseModel):
    items: list[ShareLinkRead]
    total: int
    limit: int
    offset: int


class PublicShareRead(BaseModel):
    id: int
    book_id: int
    title: str
    cover_url: str | None = None
    access_scope: ShareAccessScope
    status: ShareLinkStatus
    expires_at: datetime | None = None


class SharedPlayerQuery(BookPlayerOptions):
    pass


class SharedPlayerPayload(BookPlayerPayload):
    share: PublicShareRead
