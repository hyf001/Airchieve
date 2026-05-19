from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field

from app.model.generation_task import GenerationTaskStatus, GenerationTaskType


class GenerationErrorCode(StrEnum):
    STORY_TEXT_TOO_LONG = "STORY_TEXT_TOO_LONG"
    PAGE_COUNT_OUT_OF_RANGE = "PAGE_COUNT_OUT_OF_RANGE"
    ASSET_NOT_USABLE = "ASSET_NOT_USABLE"
    ENTITLEMENT_REQUIRED = "ENTITLEMENT_REQUIRED"
    QUOTA_NOT_ENOUGH = "QUOTA_NOT_ENOUGH"
    TEMPLATE_CONTENT_LOCKED = "TEMPLATE_CONTENT_LOCKED"
    REFERENCE_COPY_FORBIDDEN = "REFERENCE_COPY_FORBIDDEN"
    PROVIDER_TIMEOUT = "PROVIDER_TIMEOUT"
    PROVIDER_RATE_LIMITED = "PROVIDER_RATE_LIMITED"
    PROVIDER_FAILED = "PROVIDER_FAILED"
    TASK_NOT_RETRYABLE = "TASK_NOT_RETRYABLE"


class GenerationTaskCreate(BaseModel):
    task_type: GenerationTaskType
    owner_type: str = Field(min_length=1, max_length=80)
    owner_id: int
    user_id: int | None = None
    input_payload: dict = Field(default_factory=dict)
    provider: str | None = Field(default=None, max_length=80)


class GenerationTaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_type: GenerationTaskType
    owner_type: str
    owner_id: int
    user_id: int | None = None
    status: GenerationTaskStatus
    progress_percent: int
    result_refs: dict | None = None
    error_code: str | None = None
    error_message: str | None = None
    retryable: bool
    retry_count: int
    provider: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class GenerationTaskListRead(BaseModel):
    items: list[GenerationTaskRead]
    total: int
    limit: int
    offset: int
