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
        extra="ignore",
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

    # Aliyun OSS
    OSS_ACCESS_KEY_ID: str = ""
    OSS_ACCESS_KEY_SECRET: str = ""
    OSS_ENDPOINT: str = ""        # e.g. oss-cn-hangzhou.aliyuncs.com
    OSS_BUCKET_NAME: str = ""
    OSS_BASE_URL: str = ""        # 自定义域名，e.g. https://cdn.example.com（可选）

    # WeChat Pay (微信支付 APIv3)
    WECHAT_PAY_APP_ID: str = ""           # 小程序 / 公众号 AppID
    WECHAT_PAY_MCHID: str = ""            # 商户号（10位数字）
    WECHAT_PAY_API_KEY_V3: str = ""       # APIv3 密钥（32字节）
    WECHAT_PAY_CERT_SERIAL_NO: str = ""   # 商户 API 证书序列号
    WECHAT_PAY_PRIVATE_KEY: str = ""      # 商户私钥 PEM（多行用 \n 连接，存于 .env）
    WECHAT_PAY_NOTIFY_URL: str = ""       # 回调基础 URL，如 https://example.com/api/v1/payment/notify


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
