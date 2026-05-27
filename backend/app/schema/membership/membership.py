from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field

from app.model.membership import (
    BillingPeriod,
    MembershipPlanStatus,
    MembershipSource,
    UserMembershipStatus,
)


class EntitlementAccessLevel(StrEnum):
    FREE = "free"
    MEMBER = "member"


class PdfExportQuality(StrEnum):
    STANDARD = "standard"
    HD = "hd"


class EntitlementConfigDTO(BaseModel):
    access_level: EntitlementAccessLevel = EntitlementAccessLevel.FREE
    book_access_level: EntitlementAccessLevel = EntitlementAccessLevel.FREE
    child_profile_limit: int = Field(default=1, ge=0)
    story_limit: int = Field(default=20, ge=0)
    character_limit: int = Field(default=3, ge=0)
    voice_limit: int = Field(default=1, ge=0)
    share_monthly_limit: int = Field(default=5, ge=0)
    book_generation_monthly_limit: int = Field(default=0, ge=0)
    pdf_export_monthly_limit: int = Field(default=0, ge=0)
    vip_asset_enabled: bool = False
    pdf_export_quality: PdfExportQuality = PdfExportQuality.STANDARD


class MembershipPlanSummary(BaseModel):
    id: int | None = None
    name: str
    billing_period: BillingPeriod


class MembershipPlanRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None
    price_cents: int
    currency: str
    billing_period: BillingPeriod
    entitlement_config: EntitlementConfigDTO
    sort_order: int
    status: MembershipPlanStatus
    created_at: datetime
    updated_at: datetime


class MembershipPlanCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    price_cents: int = Field(ge=0)
    currency: str = Field(default="CNY", min_length=3, max_length=3)
    billing_period: BillingPeriod
    entitlement_config: EntitlementConfigDTO
    sort_order: int = 0
    status: MembershipPlanStatus = MembershipPlanStatus.ACTIVE


class MembershipPlanUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    price_cents: int | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    billing_period: BillingPeriod | None = None
    entitlement_config: EntitlementConfigDTO | None = None
    sort_order: int | None = None
    status: MembershipPlanStatus | None = None


class MembershipPlanStatusUpdate(BaseModel):
    status: MembershipPlanStatus
    reason: str | None = Field(default=None, max_length=500)


class UserMembershipRead(BaseModel):
    user_id: int
    plan: MembershipPlanSummary
    status: UserMembershipStatus
    started_at: datetime | None = None
    current_period_start: datetime | None = None
    current_period_end: datetime | None = None
    auto_renew: bool
    source: MembershipSource


class SubscriptionChangePayload(BaseModel):
    plan_id: int
    status: UserMembershipStatus = UserMembershipStatus.ACTIVE
    started_at: datetime | None = None
    current_period_start: datetime | None = None
    current_period_end: datetime | None = None
    auto_renew: bool = False
    source: MembershipSource = MembershipSource.PAYMENT
