from pydantic import BaseModel, Field

from app.model.account import UserRole
from app.schema.analytics import OperationDashboardRead


class AdminOperatorDTO(BaseModel):
    operator_id: int
    role: UserRole
    permission_codes: list[str] = Field(default_factory=list)


class AdminDashboardRead(BaseModel):
    pending_moderation_count: int
    report_count: int
    audit_log_count: int
    analytics: OperationDashboardRead


class AdminContentOverviewRead(BaseModel):
    stories: int
    books: int
    templates: int
    characters: int
    voices: int
    background_music: int
    share_links: int
    export_jobs: int
