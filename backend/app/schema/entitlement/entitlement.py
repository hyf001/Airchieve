from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field

from app.model.entitlement import QuotaReservationStatus
from app.model.membership import UserMembershipStatus
from app.schema.membership import EntitlementAccessLevel, PdfExportQuality


class EntitlementQuotaKey(StrEnum):
    BOOK_GENERATION_MONTHLY = "book_generation_monthly"
    SHARE_MONTHLY = "share_monthly"
    PDF_EXPORT_MONTHLY = "pdf_export_monthly"


class EntitlementResourceType(StrEnum):
    CHILD_PROFILE = "child_profile"
    STORY = "story"
    CHARACTER = "character"
    VOICE = "voice"
    BOOK_GENERATION = "book_generation"
    SHARE = "share"
    PDF_EXPORT = "pdf_export"


class EntitlementLimits(BaseModel):
    child_profile_limit: int = Field(ge=0)
    story_limit: int = Field(ge=0)
    character_limit: int = Field(ge=0)
    voice_limit: int = Field(ge=0)
    share_monthly_limit: int = Field(ge=0)
    book_generation_monthly_limit: int = Field(ge=0)
    pdf_export_monthly_limit: int = Field(ge=0)
    pdf_export_quality: PdfExportQuality


class EntitlementUsages(BaseModel):
    period_key: str
    book_generation_monthly_used: int = Field(ge=0)
    book_generation_monthly_reserved: int = Field(ge=0)
    share_monthly_used: int = Field(ge=0)
    share_monthly_reserved: int = Field(ge=0)
    pdf_export_monthly_used: int = Field(ge=0)
    pdf_export_monthly_reserved: int = Field(ge=0)


class VipPermissions(BaseModel):
    vip_asset_enabled: bool
    system_story_vip_enabled: bool
    system_template_vip_enabled: bool
    export_hd_enabled: bool


class UserEntitlementsRead(BaseModel):
    plan_id: int | None = None
    membership_status: UserMembershipStatus
    access_level: EntitlementAccessLevel
    book_access_level: EntitlementAccessLevel
    limits: EntitlementLimits
    usages: EntitlementUsages
    vip_permissions: VipPermissions


class AccessDecision(BaseModel):
    allowed: bool
    access_level: EntitlementAccessLevel
    preview_pages: int | None = Field(default=None, ge=0)
    reason_code: str | None = None
    upgrade_required: bool = False


class QuotaReservationRead(BaseModel):
    id: int
    quota_key: EntitlementQuotaKey
    amount: int
    status: QuotaReservationStatus
    expires_at: datetime | None = None


class QuotaUsageRead(BaseModel):
    quota_key: EntitlementQuotaKey
    used_amount: int = Field(ge=0)
    limit_amount: int | None = Field(default=None, ge=0)
    remaining_amount: int | None = Field(default=None, ge=0)
    period_key: str
