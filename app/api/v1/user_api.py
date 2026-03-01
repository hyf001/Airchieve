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

from app.api.deps import get_current_user, get_current_admin
from app.models.user import User, UserRole, UserStatus, MembershipLevel
from app.services import points_service, user_service, payment_service


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


# ---------------------------------------------------------------------------
# 内部辅助
# ---------------------------------------------------------------------------

def _user_to_out(u: User) -> UserOut:
    return UserOut(
        id=u.id,
        nickname=u.nickname,
        avatar_url=u.avatar_url,
        role=u.role,
        status=u.status,
        membership_level=u.membership_level,
        membership_expire_at=u.membership_expire_at.isoformat() if u.membership_expire_at else None,
        points_balance=u.points_balance,
        free_creation_remaining=u.free_creation_remaining,
        created_at=u.created_at.isoformat(),
    )


# ---------------------------------------------------------------------------
# 管理员端点
# ---------------------------------------------------------------------------

class UserListResponse(BaseModel):
    total: int
    items: list[UserOut]


class AdminUpdateUserRequest(BaseModel):
    status:                  str | None = Field(None, description="active | banned")
    role:                    str | None = Field(None, description="admin | user")
    points_delta:            int | None = Field(None, description="积分增减（可正可负）")
    points_description:      str | None = Field(None, description="积分调整备注")
    free_creation_remaining: int | None = Field(None, ge=0, description="直接设置免费次数")
    membership_level:        str | None = Field(None, description="free | lite | pro | max")
    membership_expire_at:    str | None = Field(None, description="会员到期时间 ISO 字符串，null 表示清除")


@router.get("/", response_model=UserListResponse)
async def admin_list_users(
    page:   int = 1,
    size:   int = 20,
    search: str | None = None,
    _admin: User = Depends(get_current_admin),
):
    """管理员：获取用户列表（分页 + 按昵称/ID 搜索）"""
    users, total = await user_service.list_users(
        page=page, size=min(size, 100), search=search
    )
    return UserListResponse(total=total, items=[_user_to_out(u) for u in users])


@router.patch("/{user_id}", response_model=UserOut)
async def admin_update_user(
    user_id: int,
    req:     AdminUpdateUserRequest,
    _admin:  User = Depends(get_current_admin),
):
    """管理员：更新用户状态/角色/积分/免费次数/会员等级"""
    from datetime import datetime

    valid_statuses = {s.value for s in UserStatus}
    valid_roles    = {r.value for r in UserRole}
    valid_levels   = {m.value for m in MembershipLevel}

    if req.status is not None and req.status not in valid_statuses:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"无效的状态值: {req.status}")
    if req.role is not None and req.role not in valid_roles:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"无效的角色值: {req.role}")
    if req.membership_level is not None and req.membership_level not in valid_levels:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"无效的会员等级: {req.membership_level}")

    if await user_service.get_user(user_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "用户不存在")

    if req.status is not None or req.role is not None:
        await user_service.admin_update_user(user_id, status=req.status, role=req.role)

    if req.points_delta is not None and req.points_delta != 0:
        try:
            await points_service.admin_adjust_points(
                user_id=user_id,
                delta=req.points_delta,
                description=req.points_description or "管理员调整",
            )
        except ValueError as e:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))

    if req.free_creation_remaining is not None:
        await points_service.admin_set_free_creation(user_id, req.free_creation_remaining)

    if req.membership_level is not None:
        expire_at = None
        if req.membership_expire_at:
            expire_at = datetime.fromisoformat(req.membership_expire_at)
        await payment_service.admin_set_membership(user_id, req.membership_level, expire_at)

    user = await user_service.get_user(user_id)
    return _user_to_out(user)  # type: ignore[arg-type]
