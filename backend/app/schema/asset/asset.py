from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.model.asset import (
    ArtStyleStatus,
    AssetAccessLevel,
    AssetKind,
    AssetSourceType,
    AssetStatus,
    AssetVisibility,
    LibraryItemStatus,
)
from app.model.generation_task import GenerationTaskStatus


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
    code: str | None = Field(default=None, min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=1000)
    prompt: str | None = Field(default=None, max_length=2000)
    example_asset_id: int | None = None
    example_url: str | None = Field(default=None, max_length=500)
    example_image_base64: str | None = Field(default=None, min_length=1)
    example_image_mime_type: str = Field(default="image/png", min_length=1, max_length=120)
    example_image_filename: str = Field(default="art-style-preview.png", min_length=1, max_length=240)
    age_range_codes: list[str] = Field(default_factory=list)
    access_level: AssetAccessLevel = AssetAccessLevel.FREE
    sort_order: int = 0
    status: ArtStyleStatus = ArtStyleStatus.ACTIVE


class CustomArtStyleUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=80)
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, min_length=1, max_length=1000)
    prompt: str | None = Field(default=None, max_length=2000)
    example_asset_id: int | None = None
    example_url: str | None = Field(default=None, max_length=500)
    example_image_base64: str | None = Field(default=None, min_length=1)
    example_image_mime_type: str | None = Field(default=None, min_length=1, max_length=120)
    example_image_filename: str | None = Field(default=None, min_length=1, max_length=240)
    age_range_codes: list[str] | None = None
    access_level: AssetAccessLevel | None = None
    sort_order: int | None = None
    status: ArtStyleStatus | None = None


class SystemArtStyleCreate(BaseModel):
    code: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=1000)
    prompt: str | None = Field(default=None, max_length=2000)
    example_asset_id: int | None = None
    example_url: str | None = Field(default=None, max_length=500)
    example_image_base64: str | None = Field(default=None, min_length=1)
    example_image_mime_type: str = Field(default="image/png", min_length=1, max_length=120)
    example_image_filename: str = Field(default="art-style-preview.png", min_length=1, max_length=240)
    age_range_codes: list[str] = Field(default_factory=list)
    access_level: AssetAccessLevel = AssetAccessLevel.FREE
    sort_order: int = 0
    status: ArtStyleStatus = ArtStyleStatus.ACTIVE


class SystemArtStyleUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=80)
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, min_length=1, max_length=1000)
    prompt: str | None = Field(default=None, max_length=2000)
    example_asset_id: int | None = None
    example_url: str | None = Field(default=None, max_length=500)
    example_image_base64: str | None = Field(default=None, min_length=1)
    example_image_mime_type: str | None = Field(default=None, min_length=1, max_length=120)
    example_image_filename: str | None = Field(default=None, min_length=1, max_length=240)
    age_range_codes: list[str] | None = None
    access_level: AssetAccessLevel | None = None
    sort_order: int | None = None
    status: ArtStyleStatus | None = None


class ArtStyleImageUploadRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    base64_data: str | None = Field(default=None, min_length=1, alias="base64")
    data_url: str | None = Field(default=None, min_length=1)
    mime_type: str = Field(default="image/png", min_length=1, max_length=120)
    filename: str = Field(default="art-style-preview.png", min_length=1, max_length=240)

    @model_validator(mode="after")
    def normalize_base64_data(self) -> "ArtStyleImageUploadRequest":
        if self.data_url and not self.base64_data:
            self.base64_data = self.data_url
        if not self.base64_data:
            raise ValueError("必须提供 base64 或 data_url")
        return self


class VoiceAudioUploadRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    base64_data: str | None = Field(default=None, min_length=1, alias="base64")
    data_url: str | None = Field(default=None, min_length=1)
    mime_type: str = Field(default="audio/mpeg", min_length=1, max_length=120)
    filename: str = Field(default="voice-sample.mp3", min_length=1, max_length=240)

    @model_validator(mode="after")
    def normalize_base64_data(self) -> "VoiceAudioUploadRequest":
        if self.data_url and not self.base64_data:
            self.base64_data = self.data_url
        if not self.base64_data:
            raise ValueError("必须提供 base64 或 data_url")
        return self


class CharacterSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_user_id: int | None = None
    name: str
    description: str | None = None
    image_url: str | None = None
    art_style_id: int | None = None
    category_code: str | None = None
    access_level: AssetAccessLevel
    source_type: AssetSourceType
    is_default: bool
    generation_task_id: int | None = None
    generation_status: GenerationTaskStatus | None = None
    generation_progress_percent: int | None = None
    generation_error_message: str | None = None
    status: LibraryItemStatus
    created_at: datetime
    updated_at: datetime


class CharacterRead(CharacterSummary):
    reference_character_id: int | None = None
    generation_prompt: str | None = None
    art_style: ArtStyleRead | None = None


class CharacterListRead(BaseModel):
    items: list[CharacterSummary]
    total: int
    limit: int
    offset: int


class CharacterCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    reference_character_id: int | None = None
    reference_asset_id: int | None = None
    upload_consent_id: int | None = None
    art_style_id: int | None = None
    generation_prompt: str | None = Field(default=None, max_length=2000)
    category_code: str | None = None


class CharacterUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    image_url: str | None = Field(default=None, max_length=500)
    art_style_id: int | None = None
    generation_prompt: str | None = Field(default=None, max_length=2000)
    category_code: str | None = Field(default=None, max_length=64)


class SystemCharacterCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    image_url: str | None = Field(default=None, max_length=500)
    art_style_id: int | None = None
    generation_prompt: str | None = Field(default=None, max_length=2000)
    category_code: str | None = Field(default=None, max_length=64)
    access_level: AssetAccessLevel = AssetAccessLevel.FREE
    status: LibraryItemStatus = LibraryItemStatus.ACTIVE

    @model_validator(mode="after")
    def require_image(self) -> "SystemCharacterCreate":
        if not (self.image_url and self.image_url.strip()):
            raise ValueError("必须填写系统形象图片地址")
        if self.status == LibraryItemStatus.DELETED:
            raise ValueError("创建系统形象时不能使用删除状态")
        return self


class SystemCharacterUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    image_url: str | None = Field(default=None, max_length=500)
    art_style_id: int | None = None
    generation_prompt: str | None = Field(default=None, max_length=2000)
    category_code: str | None = Field(default=None, max_length=64)
    access_level: AssetAccessLevel | None = None
    status: LibraryItemStatus | None = None

    @model_validator(mode="after")
    def reject_deleted_status(self) -> "SystemCharacterUpdate":
        if self.status == LibraryItemStatus.DELETED:
            raise ValueError("请使用删除接口删除系统形象")
        return self


class VoiceSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_user_id: int | None = None
    name: str
    voice_style_code: str | None = None
    emotion_type: str | None = None
    sample_url: str | None = None
    duration_seconds: int | None = None
    access_level: AssetAccessLevel
    source_type: AssetSourceType
    is_default: bool
    status: LibraryItemStatus
    created_at: datetime
    updated_at: datetime


class VoiceRead(VoiceSummary):
    pass


class VoiceListRead(BaseModel):
    items: list[VoiceSummary]
    total: int
    limit: int
    offset: int


class VoiceCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    voice_style_code: str | None = Field(default=None, max_length=64)
    emotion_type: str | None = Field(default=None, max_length=64)
    sample_url: str | None = Field(default=None, max_length=500)
    duration_seconds: int | None = Field(default=None, ge=1, le=3600)


class VoiceUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    voice_style_code: str | None = Field(default=None, max_length=64)
    emotion_type: str | None = Field(default=None, max_length=64)
    sample_url: str | None = Field(default=None, max_length=500)
    duration_seconds: int | None = Field(default=None, ge=1, le=3600)


class SystemVoiceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    voice_style_code: str | None = Field(default=None, max_length=64)
    emotion_type: str | None = Field(default=None, max_length=64)
    sample_url: str | None = Field(default=None, max_length=500)
    duration_seconds: int | None = Field(default=None, ge=1, le=3600)
    access_level: AssetAccessLevel = AssetAccessLevel.FREE
    status: LibraryItemStatus = LibraryItemStatus.ACTIVE

    @model_validator(mode="after")
    def reject_deleted_status(self) -> "SystemVoiceCreate":
        if self.status == LibraryItemStatus.DELETED:
            raise ValueError("创建系统声音时不能使用删除状态")
        return self


class SystemVoiceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    voice_style_code: str | None = Field(default=None, max_length=64)
    emotion_type: str | None = Field(default=None, max_length=64)
    sample_url: str | None = Field(default=None, max_length=500)
    duration_seconds: int | None = Field(default=None, ge=1, le=3600)
    access_level: AssetAccessLevel | None = None
    status: LibraryItemStatus | None = None

    @model_validator(mode="after")
    def reject_deleted_status(self) -> "SystemVoiceUpdate":
        if self.status == LibraryItemStatus.DELETED:
            raise ValueError("请使用删除接口删除系统声音")
        return self


class SystemVoiceSampleGenerateRequest(BaseModel):
    voice_id: int | None = None
    voice_style_code: str = Field(min_length=1, max_length=64)
    emotion_type: str | None = Field(default=None, max_length=64)
    sample_text: str = Field(min_length=1, max_length=500)


class AssetInternalDTO(BaseModel):
    asset_type: str
    asset_id: int
    owner_user_id: int | None = None
    access_level: AssetAccessLevel = AssetAccessLevel.FREE
    source_type: AssetSourceType
    usable: bool = True
