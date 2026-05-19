from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.model.privacy import (
    PrivacyAction,
    PrivacyDeletionPolicy,
    PrivacyVisibility,
    UploadConsentTargetType,
)


class UploadConsentCreate(BaseModel):
    target_type: UploadConsentTargetType
    target_id: int | None = None
    consent_text_version: str = Field(default="2026-05-asset-upload", max_length=40)
    confirmed_rights: bool
    confirmed_privacy: bool


class UploadConsentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    target_type: UploadConsentTargetType
    target_id: int | None = None
    consent_text_version: str
    confirmed_rights: bool
    confirmed_privacy: bool
    created_at: datetime


class PrivacyTarget(BaseModel):
    target_type: str = Field(min_length=1, max_length=80)
    target_id: int


class PrivacyConfirmationCreate(BaseModel):
    action: PrivacyAction
    target: PrivacyTarget
    risk_flags: list[str] = Field(default_factory=list)
    confirmation_text_version: str = Field(default="2026-05-personal-asset-risk", max_length=40)


class PrivacyConfirmationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    action: PrivacyAction
    target_type: str
    target_id: int
    risk_flags: list[str] = Field(default_factory=list)
    confirmation_text_version: str
    created_at: datetime


class PrivacyFlagsRead(BaseModel):
    target_type: str
    target_id: int
    risk_flags: list[str] = Field(default_factory=list)
    requires_confirmation: bool
    latest_confirmation_id: int | None = None
    visibility: PrivacyVisibility = PrivacyVisibility.PRIVATE
    deletion_policy: PrivacyDeletionPolicy = PrivacyDeletionPolicy.SOFT_DELETE
