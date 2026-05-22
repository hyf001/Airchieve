from enum import StrEnum


class AssetKind(StrEnum):
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"
    PDF = "pdf"
    OTHER = "other"


class AssetVisibility(StrEnum):
    PRIVATE = "private"
    PUBLIC = "public"
    SYSTEM = "system"


class AssetStatus(StrEnum):
    UPLOADING = "uploading"
    READY = "ready"
    DELETED = "deleted"


class AssetAccessLevel(StrEnum):
    FREE = "free"
    VIP = "vip"


class AssetSourceType(StrEnum):
    SYSTEM = "system"
    AI_GENERATED = "ai_generated"
    USER_UPLOAD = "user_upload"
    VOICE_CLONE = "voice_clone"


class AssetModerationStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    HIDDEN = "hidden"


class LibraryItemStatus(StrEnum):
    ACTIVE = "active"
    DELETED = "deleted"
    DISABLED = "disabled"


class ArtStyleStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    DELETED = "deleted"


class VoiceProcessingStatus(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"
