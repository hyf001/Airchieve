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
