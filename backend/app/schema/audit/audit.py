from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.model.audit import AuditOperatorType, AuditResult


class AuditSnapshot(BaseModel):
    values: dict[str, object] = Field(default_factory=dict)


class AuditLogCreateInternal(BaseModel):
    operator_type: AuditOperatorType
    operator_id: int | None = None
    action: str = Field(min_length=1, max_length=120)
    target_type: str = Field(min_length=1, max_length=80)
    target_id: int
    before_snapshot: AuditSnapshot | None = None
    after_snapshot: AuditSnapshot | None = None
    result: AuditResult = AuditResult.SUCCEEDED
    reason: str | None = None
    request_id: str | None = None
    ip_hash: str | None = None
    user_agent: str | None = None


class AuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    operator_type: AuditOperatorType
    operator_id: int | None
    action: str
    target_type: str
    target_id: int
    before_snapshot: AuditSnapshot | None
    after_snapshot: AuditSnapshot | None
    result: AuditResult
    reason: str | None
    request_id: str | None
    ip_hash: str | None
    user_agent: str | None
    created_at: datetime


class AuditLogListRead(BaseModel):
    items: list[AuditLogRead]
    total: int
    limit: int
    offset: int
