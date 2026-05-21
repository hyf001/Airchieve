from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.model.moderation import ModerationStatus, ReportReasonType, ReportStatus


class ModerationSnapshot(BaseModel):
    title: str | None = None
    summary: str | None = None
    owner_user_id: int | None = None
    preview_url: str | None = None
    values: dict[str, object] = Field(default_factory=dict)


class ModerationTarget(BaseModel):
    target_type: str = Field(min_length=1, max_length=80)
    target_id: int = Field(ge=1)


class ReportCreate(ModerationTarget):
    reason_type: ReportReasonType
    description: str | None = Field(default=None, max_length=1000)


class ModerationReportRead(ModerationTarget):
    model_config = ConfigDict(from_attributes=True)

    id: int
    reporter_user_id: int | None
    reason_type: ReportReasonType
    description: str | None
    status: ReportStatus
    handler_id: int | None
    result: str | None
    created_at: datetime
    updated_at: datetime


class ModerationRecordRead(ModerationTarget):
    model_config = ConfigDict(from_attributes=True)

    id: int
    submitter_user_id: int | None
    status: ModerationStatus
    reason: str | None
    reviewer_id: int | None
    reviewed_at: datetime | None
    snapshot: ModerationSnapshot
    created_at: datetime
    updated_at: datetime


class ModerationRecordListRead(BaseModel):
    items: list[ModerationRecordRead]
    total: int
    limit: int
    offset: int


class ModerationHandleRequest(BaseModel):
    status: ModerationStatus
    reason: str = Field(min_length=1, max_length=1000)
    report_result: str | None = Field(default=None, max_length=1000)


class ModerationRecordCreateInternal(ModerationTarget):
    submitter_user_id: int | None = None
    status: ModerationStatus = ModerationStatus.PENDING
    reason: str | None = None
    snapshot: ModerationSnapshot = Field(default_factory=ModerationSnapshot)
