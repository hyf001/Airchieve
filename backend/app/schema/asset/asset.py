from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.model.asset import (
    ArtStyleStatus,
    AssetAccessLevel,
    AssetKind,
    AssetModerationStatus,
    AssetSourceType,
    AssetStatus,
    AssetVisibility,
    LibraryItemStatus,
    VoiceProcessingStatus,
)


class AssetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_user_id: int | None = None
    asset_kind: AssetKind
    storage_key: str
    mime_type: str
    byte_size: int | None = None
    visibility: AssetVisibility
    status: AssetStatus
    created_at: datetime
    updated_at: datetime


class AssetStorageDTO(BaseModel):
    id: int
    storage_key: str
    url: str
    mime_type: str
    byte_size: int | None = None


class ArtStyleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_user_id: int | None = None
    code: str | None = None
    name: str
    description: str
    prompt: str | None = None
    example_asset_id: int | None = None
    example_url: str | None = None
    age_range_codes: list[str] = Field(default_factory=list)
    access_level: AssetAccessLevel
    sort_order: int
    status: ArtStyleStatus
    created_at: datetime
    updated_at: datetime


class ArtStyleListRead(BaseModel):
    items: list[ArtStyleRead]
    total: int
    limit: int
    offset: int


class CustomArtStyleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=1000)
    prompt: str | None = Field(default=None, max_length=2000)


class CharacterSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_user_id: int | None = None
    name: str
    identity_tag: str | None = None
    description: str | None = None
    image_asset_id: int | None = None
    image_url: str | None = None
    art_style_id: int | None = None
    art_style_code: str | None = None
    custom_art_style_prompt: str | None = None
    age_range_codes: list[str] = Field(default_factory=list)
    access_level: AssetAccessLevel
    source_type: AssetSourceType
    is_default: bool
    moderation_status: AssetModerationStatus
    status: LibraryItemStatus
    created_at: datetime
    updated_at: datetime


class CharacterRead(CharacterSummary):
    reference_asset_id: int | None = None
    generation_prompt: str | None = None
    category_code: str | None = None
    art_style: ArtStyleRead | None = None


class CharacterListRead(BaseModel):
    items: list[CharacterSummary]
    total: int
    limit: int
    offset: int


class CharacterCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    identity_tag: str | None = Field(default=None, max_length=80)
    description: str | None = Field(default=None, max_length=1000)
    reference_asset_id: int | None = None
    upload_consent_id: int | None = None
    art_style_id: int | None = None
    custom_art_style_prompt: str | None = Field(default=None, max_length=2000)
    generation_prompt: str = Field(min_length=1, max_length=2000)
    category_code: str | None = None
    age_range_codes: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def require_art_style(self) -> "CharacterCreateRequest":
        if self.art_style_id is None and not (self.custom_art_style_prompt and self.custom_art_style_prompt.strip()):
            raise ValueError("必须选择系统画风或填写自定义画风描述")
        return self


class CharacterUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    identity_tag: str | None = Field(default=None, max_length=80)
    description: str | None = Field(default=None, max_length=1000)


class VoiceSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_user_id: int | None = None
    name: str
    voice_style_code: str | None = None
    sample_asset_id: int | None = None
    sample_url: str | None = None
    supported_languages: list[str] = Field(default_factory=list)
    duration_seconds: int | None = None
    access_level: AssetAccessLevel
    source_type: AssetSourceType
    processing_status: VoiceProcessingStatus
    failure_reason: str | None = None
    is_default: bool
    moderation_status: AssetModerationStatus
    status: LibraryItemStatus
    created_at: datetime
    updated_at: datetime


class VoiceRead(VoiceSummary):
    source_sample_asset_id: int | None = None


class VoiceListRead(BaseModel):
    items: list[VoiceSummary]
    total: int
    limit: int
    offset: int


class VoiceCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    source_sample_asset_id: int
    supported_languages: list[str] = Field(default_factory=lambda: ["zh"])
    duration_seconds: int | None = Field(default=None, ge=1, le=3600)
    upload_consent_id: int


class VoiceUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)


class AssetInternalDTO(BaseModel):
    asset_type: str
    asset_id: int
    owner_user_id: int | None = None
    access_level: AssetAccessLevel = AssetAccessLevel.FREE
    source_type: AssetSourceType
    usable: bool = True
