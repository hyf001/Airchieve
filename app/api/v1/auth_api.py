"""
Auth API
用户认证接口 - 登录/注册
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, verify_password
from app.db.session import get_db
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


# ============ Schemas ============
class LoginRequest(BaseModel):
    account: str = Field(..., min_length=2, max_length=64)
    password: str = Field(..., min_length=6, max_length=128)


class RegisterRequest(BaseModel):
    account: str = Field(..., min_length=2, max_length=64)
    password: str = Field(..., min_length=6, max_length=128)
    name: str = Field(..., min_length=1, max_length=128)
    email: str | None = Field(None, max_length=255)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserInfo"


class UserInfo(BaseModel):
    id: int
    account: str
    name: str
    email: str | None
    role: str

    class Config:
        from_attributes = True


# ============ Endpoints ============
@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    """用户登录"""
    # 查找用户
    user = (
        await db.execute(select(User).where(User.account == req.account))
    ).scalar_one_or_none()

    if user is None or not verify_password(req.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="账号或密码错误",
        )

    # 更新最后登录时间
    user.last_login_time = datetime.now(timezone.utc)
    await db.commit()

    # 生成 token
    access_token = create_access_token(data={"sub": str(user.id)})

    return TokenResponse(
        access_token=access_token,
        user=UserInfo(
            id=user.id,
            account=user.account,
            name=user.name,
            email=user.email,
            role=user.role,
        ),
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """用户注册"""
    # 检查账号是否已存在
    existing = (
        await db.execute(select(User).where(User.account == req.account))
    ).scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="账号已存在",
        )

    # 创建用户
    user = User(
        account=req.account,
        password=req.password,
        name=req.name,
        email=req.email,
        role="register",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # 生成 token
    access_token = create_access_token(data={"sub": str(user.id)})

    return TokenResponse(
        access_token=access_token,
        user=UserInfo(
            id=user.id,
            account=user.account,
            name=user.name,
            email=user.email,
            role=user.role,
        ),
    )
