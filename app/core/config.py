from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict

# Airchieve 项目根目录
AIRCHIEVE_ROOT = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    # Project
    PROJECT_NAME: str = "Pictora"
    VERSION: str = "0.1.0"
    DESCRIPTION: str = "Pictora API"
    API_V1_STR: str = "/api/v1"

    # CORS
    CORS_ORIGINS: List[str] = ["*"]

    # 用户项目根目录
    USER_PROJECTS_ROOT: str = str(AIRCHIEVE_ROOT / "data" / "projects")

    # Database
    # 开发环境: sqlite+aiosqlite:///path/to/app.db
    # 生产环境: mysql+aiomysql://user:password@host:port/dbname
    DATABASE_URL: str = "sqlite+aiosqlite:///data/app.db"

    # Security
    SECRET_KEY: str = ""
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ALGORITHM: str = "HS256"

    # Debug
    DEBUG: bool = False

    # Gemini API
    GEMINI_API_KEY: str = ""
    GEMINI_API_URL: str | None = None
    GEMINI_MODEL: str = "gemini-3-pro-image-preview"  # 默认模型

    # Anthropic API
    ANTHROPIC_AUTH_TOKEN: str = ""
    ANTHROPIC_BASE_URL: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
