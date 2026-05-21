from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    PROJECT_NAME: str = "AIrchieve API"
    VERSION: str = "0.1.0"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = False
    DATABASE_URL: str = "sqlite+aiosqlite:///data/airchieve.db"
    SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_SECONDS: int = 60 * 30
    REFRESH_TOKEN_EXPIRE_SECONDS: int = 60 * 60 * 24 * 30
    SMS_CODE_EXPIRE_SECONDS: int = 60
    SMS_CODE_COOLDOWN_SECONDS: int = 60
    ALIYUN_SMS_ACCESS_KEY_ID: str | None = None
    ALIYUN_SMS_ACCESS_KEY_SECRET: str | None = None
    ALIYUN_SMS_ENDPOINT: str = "dysmsapi.aliyuncs.com"
    ALIYUN_SMS_SIGN_NAME: str | None = None
    ALIYUN_SMS_TEMPLATE_CODE: str | None = None
    OSS_ACCESS_KEY_ID: str | None = None
    OSS_ACCESS_KEY_SECRET: str | None = None
    OSS_ENDPOINT: str | None = None
    OSS_BUCKET_NAME: str | None = None
    OSS_UPLOAD_EXPIRE_SECONDS: int = 60 * 10
    OSS_DOWNLOAD_EXPIRE_SECONDS: int = 60 * 10
    TERMS_VERSION: str = "2026-05-16"
    PRIVACY_VERSION: str = "2026-05-16"
    AI_PROVIDER_DEFAULT: str = "gemini"
    AI_PROVIDER_TEXT: str | None = None
    AI_PROVIDER_STRUCTURED: str | None = None
    AI_PROVIDER_IMAGE: str | None = None
    AI_PROVIDER_AUDIO: str | None = None
    AI_PROVIDER_LIP_SYNC: str | None = "kling_avatar"
    GEMINI_API_KEY: str | None = None
    GEMINI_API_URL: str | None = None
    GEMINI_TEXT_MODEL: str = "gemini-2.5-flash"
    GEMINI_IMAGE_MODEL: str = "gemini-2.0-flash-preview-image-generation"
    GEMINI_TTS_MODEL: str = "gemini-3.1-flash-tts-preview"
    GEMINI_TTS_VOICE: str = "Kore"
    DOUBAO_API_KEY: str | None = None
    DOUBAO_BASE_URL: str = "https://ark.cn-beijing.volces.com/api/v3"
    DOUBAO_TEXT_MODEL: str | None = None
    DOUBAO_IMAGE_MODEL: str | None = None
    DOUBAO_TTS_APP_ID: str | None = None
    DOUBAO_TTS_ACCESS_TOKEN: str | None = None
    DOUBAO_TTS_CLUSTER: str | None = None
    DOUBAO_TTS_VOICE_TYPE: str | None = None
    DOUBAO_TTS_API_URL: str = "https://openspeech.bytedance.com/api/v1/tts"
    KLING_AVATAR_API_KEY: str | None = None
    KLING_AVATAR_BASE_URL: str = "https://api.poyo.ai"
    KLING_AVATAR_MODEL: str = "kling-avatar-2.0/standard"
    KLING_AVATAR_SUBMIT_PATH: str = "/api/generate/submit"
    KLING_AVATAR_STATUS_PATH: str = "/api/generate/status/{task_id}"
    KLING_AVATAR_CALLBACK_URL: str | None = None
    KLING_AVATAR_PROMPT: str = "A natural talking avatar facing the camera, warm children's picture book performance."
    KLING_AVATAR_TIMEOUT_SECONDS: int = 600
    KLING_AVATAR_POLL_INTERVAL_SECONDS: float = 5.0

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug(cls, value: object) -> object:
        if isinstance(value, str) and value.lower() in {"release", "prod", "production"}:
            return False
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
