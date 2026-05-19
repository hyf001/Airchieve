from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.model.asset import AssetKind, AssetVisibility
from app.model.storage import UploadPurpose, UploadSessionStatus


class UploadSessionCreate(BaseModel):
    purpose: UploadPurpose
    filename: str = Field(min_length=1, max_length=240)
    mime_type: str = Field(min_length=1, max_length=120)
    byte_size: int | None = Field(default=None, ge=1)


class UploadSessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int | None = None
    purpose: UploadPurpose
    filename: str
    mime_type: str
    max_byte_size: int
    storage_key: str
    upload_url: str
    upload_method: str = "PUT"
    upload_headers: dict[str, str] = Field(default_factory=dict)
    status: UploadSessionStatus
    expires_at: datetime
    created_at: datetime
    updated_at: datetime


class UploadCompleteRequest(BaseModel):
    byte_size: int | None = Field(default=None, ge=1)
    checksum: str | None = Field(default=None, max_length=128)
    asset_kind: AssetKind | None = None
    visibility: AssetVisibility = AssetVisibility.PRIVATE


class FileUrlRead(BaseModel):
    url: str
    expires_in: int | None = None
