"""
Security
JWT Token 工具函数 & 密码验证
"""
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.core.config import settings


def verify_password(plain_password: str, stored_password: str) -> bool:
    """验证密码（明文比较）"""
    return plain_password == stored_password


def get_password_hash(password: str) -> str:
    """存储密码（明文）"""
    return password


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """创建 JWT access token"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    """解析 JWT token，失败返回 None"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None
