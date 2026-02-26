"""
User API
用户信息接口（需登录）

端点：
  GET    /users/me                当前用户信息
  PATCH  /users/me                更新昵称 / 头像
  POST   /users/me/phone          绑定手机号
  GET    /users/me/points         积分 & 免费次数概览
  GET    /users/me/points/history 积分流水记录
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.models.user import User
from app.services import points_service, user_service


router = APIRouter(prefix="/users", tags=["users"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class UserOut(BaseModel):
    id:                      int
    nickname:                str
    avatar_url:              str | None
    role:                    str
    status:                  str
    membership_level:        str
    membership_expire_at:    str | None
    points_balance:          int
    free_creation_remaining: int
    created_at:              str

    class Config:
        from_attributes = True


class UpdateProfileRequest(BaseModel):
    nickname:   str | None = Field(None, min_length=1, max_length=64)
    avatar_url: str | None = Field(None, max_length=512)


class BindPhoneRequest(BaseModel):
    phone: str = Field(..., pattern=r"^1[3-9]\d{9}$")
    code:  str = Field(..., min_length=4, max_length=8, description="短信验证码")


class PointsOverview(BaseModel):
    balance:                 int
    free_creation_remaining: int


class PointsLogOut(BaseModel):
    id:               int
    delta:            int
    type:             str
    description:      str | None
    balance_after:    int
    related_order_id: str | None
    created_at:       str

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# 端点
# ---------------------------------------------------------------------------

@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    """获取当前登录用户信息"""
    return UserOut(
        id=current_user.id,
        nickname=current_user.nickname,
        avatar_url=current_user.avatar_url,
        role=current_user.role,
        status=current_user.status,
        membership_level=current_user.membership_level,
        membership_expire_at=(
            current_user.membership_expire_at.isoformat()
            if current_user.membership_expire_at else None
        ),
        points_balance=current_user.points_balance,
        free_creation_remaining=current_user.free_creation_remaining,
        created_at=current_user.created_at.isoformat(),
    )


@router.patch("/me", response_model=UserOut)
async def update_me(
    req: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
):
    """更新昵称 / 头像"""
    if req.nickname is None and req.avatar_url is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="至少提供一个要更新的字段",
        )

    updated = await user_service.update_profile(
        user_id=current_user.id,
        nickname=req.nickname,
        avatar_url=req.avatar_url,
    )
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    return UserOut(
        id=updated.id,
        nickname=updated.nickname,
        avatar_url=updated.avatar_url,
        role=updated.role,
        status=updated.status,
        membership_level=updated.membership_level,
        membership_expire_at=(
            updated.membership_expire_at.isoformat()
            if updated.membership_expire_at else None
        ),
        points_balance=updated.points_balance,
        free_creation_remaining=updated.free_creation_remaining,
        created_at=updated.created_at.isoformat(),
    )


@router.post("/me/phone", status_code=status.HTTP_204_NO_CONTENT)
async def bind_phone(
    req: BindPhoneRequest,
    current_user: User = Depends(get_current_user),
):
    """
    绑定手机号

    需先调用 POST /auth/sms/send 发送验证码，再带验证码调用此接口。
    """
    # 复用 auth_api 的验证码存储（同一进程内共享）
    from app.api.v1.auth_api import _verify_code

    if not _verify_code(req.phone, req.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="验证码错误或已过期",
        )

    try:
        await user_service.bind_phone(current_user.id, req.phone)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.get("/me/points", response_model=PointsOverview)
async def get_points(current_user: User = Depends(get_current_user)):
    """获取积分余额和免费创作次数"""
    return PointsOverview(
        balance=current_user.points_balance,
        free_creation_remaining=current_user.free_creation_remaining,
    )


@router.get("/me/points/history", response_model=list[PointsLogOut])
async def get_points_history(
    limit:  int = 20,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
):
    """积分流水记录（按时间倒序）"""
    logs = await points_service.get_points_history(
        user_id=current_user.id,
        limit=min(limit, 100),
        offset=offset,
    )
    return [
        PointsLogOut(
            id=log.id,
            delta=log.delta,
            type=log.type,
            description=log.description,
            balance_after=log.balance_after,
            related_order_id=log.related_order_id,
            created_at=log.created_at.isoformat(),
        )
        for log in logs
    ]
