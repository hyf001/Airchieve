from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.model.account import (
    AuthProvider,
    CaptchaProvider,
    ChildProfileStatus,
    ChildProfileVisibility,
    SmsScene,
    UserRole,
    UserStatus,
)


class MembershipSummary(BaseModel):
    plan: str = "free"
    status: str = "active"


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    display_name: str
    avatar_url: str | None = None
    role: UserRole
    status: UserStatus
    default_child_profile_id: str | None
    phone_masked: str | None = None
    wechat_bound: bool = False
    membership_summary: MembershipSummary = Field(default_factory=MembershipSummary)


class AccountRegisterRequest(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=80)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    phone: str = Field(min_length=6, max_length=32)
    sms_code: str = Field(min_length=4, max_length=8)
    display_name: str | None = Field(default=None, max_length=120)
    terms_version: str
    privacy_version: str


class SmsCodeSendRequest(BaseModel):
    phone: str = Field(min_length=6, max_length=32)
    scene: SmsScene
    device_id: str | None = Field(default=None, max_length=120)
    captcha_ticket: str | None = Field(default=None, max_length=255)


class SmsCodeSendResult(BaseModel):
    cooldown_seconds: int
    expires_in_seconds: int
    masked_phone: str
    dev_code: str | None = None


class PhoneLoginRequest(BaseModel):
    phone: str = Field(min_length=6, max_length=32)
    sms_code: str = Field(min_length=4, max_length=8)
    auto_register: bool = True
    device_id: str | None = Field(default=None, max_length=120)
    return_to: str | None = Field(default=None, max_length=512)
    terms_version: str | None = None
    privacy_version: str | None = None


class PasswordLoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=80)
    password: str = Field(min_length=1, max_length=128)
    device_id: str | None = Field(default=None, max_length=120)
    return_to: str | None = Field(default=None, max_length=512)


class WechatLoginRequest(BaseModel):
    code: str = Field(min_length=1, max_length=255)
    provider_app_id: str = Field(min_length=1, max_length=120)
    encrypted_phone_payload: str | None = None
    device_id: str | None = Field(default=None, max_length=120)
    return_to: str | None = Field(default=None, max_length=512)
    terms_version: str | None = None
    privacy_version: str | None = None


class CaptchaVerifyRequest(BaseModel):
    challenge_id: str
    provider: CaptchaProvider
    captcha_response: str = Field(min_length=1, max_length=1024)
    device_id: str | None = Field(default=None, max_length=120)


class CaptchaVerifyResult(BaseModel):
    captcha_ticket: str
    expires_in_seconds: int


class AuthTokenRead(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    session_id: str
    return_to: str | None = None
    user: UserRead


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class AuthBindingSummary(BaseModel):
    provider: AuthProvider
    masked_identifier: str
    bound_at: datetime
    last_login_at: datetime | None = None
    can_unbind: bool


class PhoneBindRequest(BaseModel):
    phone: str = Field(min_length=6, max_length=32)
    sms_code: str = Field(min_length=4, max_length=8)


class PhoneChangeRequest(BaseModel):
    old_phone_sms_code: str = Field(min_length=4, max_length=8)
    new_phone: str = Field(min_length=6, max_length=32)
    new_phone_sms_code: str = Field(min_length=4, max_length=8)


class PhoneUnbindRequest(BaseModel):
    sms_code: str = Field(min_length=4, max_length=8)


class WechatBindRequest(BaseModel):
    code: str = Field(min_length=1, max_length=255)
    provider_app_id: str = Field(min_length=1, max_length=120)


class ChildProfileCreate(BaseModel):
    nickname: str = Field(min_length=1, max_length=80)
    age_range_id: str | None = Field(default=None, max_length=64)
    reading_level_id: str | None = Field(default=None, max_length=64)
    interest_tag_ids: list[str] = Field(default_factory=list)
    education_goal_ids: list[str] = Field(default_factory=list)
    default_character_id: str | None = Field(default=None, max_length=64)
    default_voice_id: str | None = Field(default=None, max_length=64)
    default_art_style_id: str | None = Field(default=None, max_length=64)


class ChildProfileUpdate(BaseModel):
    nickname: str | None = Field(default=None, min_length=1, max_length=80)
    age_range_id: str | None = Field(default=None, max_length=64)
    reading_level_id: str | None = Field(default=None, max_length=64)
    interest_tag_ids: list[str] | None = None
    education_goal_ids: list[str] | None = None
    default_character_id: str | None = Field(default=None, max_length=64)
    default_voice_id: str | None = Field(default=None, max_length=64)
    default_art_style_id: str | None = Field(default=None, max_length=64)


class ChildProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    nickname: str
    age_range_id: str | None
    reading_level_id: str | None
    interest_tag_ids: list[str]
    education_goal_ids: list[str]
    default_character_id: str | None
    default_voice_id: str | None
    default_art_style_id: str | None
    visibility: ChildProfileVisibility
    is_default: bool
    status: ChildProfileStatus
    created_at: datetime
    updated_at: datetime


class ChildProfileSummary(BaseModel):
    id: str
    nickname: str
    age_range_label: str | None = None
    reading_level_label: str | None = None
    is_default: bool
    default_character_id: str | None = None
    default_voice_id: str | None = None
    default_art_style_id: str | None = None
