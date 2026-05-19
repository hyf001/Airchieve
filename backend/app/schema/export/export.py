from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.model.export import ExportJobStatus, ExportQuality, ExportType


class ExportJobCreate(BaseModel):
    export_type: ExportType = ExportType.PDF
    quality: ExportQuality = ExportQuality.STANDARD
    privacy_confirmation_id: int | None = None
    idempotency_key: str | None = Field(default=None, max_length=120)


class ExportJobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    book_id: int
    export_type: ExportType
    quality: ExportQuality
    status: ExportJobStatus
    generation_task_id: int | None = None
    file_asset_id: int | None = None
    file_url: str | None = None
    idempotency_key: str | None = None
    book_snapshot: dict[str, object]
    privacy_confirmation_id: int | None = None
    quota_reservation_id: int | None = None
    error_message: str | None = None
    expires_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class ExportJobListRead(BaseModel):
    items: list[ExportJobRead]
    total: int
    limit: int
    offset: int


class ExportFileUrlRead(BaseModel):
    export_id: int
    file_url: str
    expires_at: datetime | None = None
