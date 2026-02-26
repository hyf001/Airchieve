"""
Auth API
认证接口（身份域）

端点：
  POST /auth/register          账号密码注册
  POST /auth/login/password    账号密码登录
  POST /auth/login/sms         手机验证码登录
  POST /auth/login/wechat      微信网页扫码登录
  POST /auth/sms/send          发送短信验证码
"""
import random
import string
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.core.security import create_access_token
from app.models.user import User
from app.services import user_service


router = APIRouter(prefix="/auth", tags=["auth"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    nickname: str  = Field(..., min_length=1, max_length=64)
    account:  str  = Field(..., min_length=2, max_length=64, description="账号名（唯一）")
    password: str  = Field(..., min_length=6, max_length=128)


class PasswordLoginRequest(BaseModel):
    account:  str = Field(..., min_length=2, max_length=64)
    password: str = Field(..., min_length=6, max_length=128)


class SmsLoginRequest(BaseModel):
    phone: str = Field(..., pattern=r"^1[3-9]\d{9}$", description="11 位手机号")
    code:  str = Field(..., min_length=4, max_length=8, description="短信验证码")


class WechatLoginRequest(BaseModel):
    openid:   str           = Field(..., description="微信 openid（前端 OAuth 后获取）")
    nickname: str           = Field(..., min_length=1, max_length=64)
    avatar_url: str | None  = Field(None, max_length=512)
    unionid:  str | None    = Field(None, description="微信 unionid（可选）")


class SmsSendRequest(BaseModel):
    phone: str = Field(..., pattern=r"^1[3-9]\d{9}$")


class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    user:         "UserOut"
    is_new_user:  bool = False


class UserOut(BaseModel):
    id:                      int
    nickname:                str
    avatar_url:              str | None
    role:                    str
    membership_level:        str
    points_balance:          int
    free_creation_remaining: int

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# 短信验证码临时存储（开发用，生产应替换为 Redis）
# ---------------------------------------------------------------------------

_sms_store: dict[str, tuple[str, datetime]] = {}   # phone → (code, expire_at)
_SMS_EXPIRE_MINUTES = 5


def _generate_code() -> str:
    return "".join(random.choices(string.digits, k=6))


def _save_code(phone: str, code: str) -> None:
    expire = datetime.now(timezone.utc) + timedelta(minutes=_SMS_EXPIRE_MINUTES)
    _sms_store[phone] = (code, expire)


def _verify_code(phone: str, code: str) -> bool:
    entry = _sms_store.get(phone)
    if not entry:
        return False
    saved_code, expire = entry
    if datetime.now(timezone.utc) > expire:
        _sms_store.pop(phone, None)
        return False
    if saved_code != code:
        return False
    _sms_store.pop(phone, None)  # 验证成功后销毁
    return True


# ---------------------------------------------------------------------------
# 工具
# ---------------------------------------------------------------------------

def _make_token(user: User) -> TokenResponse:
    token = create_access_token(data={"sub": str(user.id)})
    return TokenResponse(
        access_token=token,
        user=UserOut.model_validate(user),
    )


# ---------------------------------------------------------------------------
# 端点
# ---------------------------------------------------------------------------

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest):
    """账号密码注册"""
    try:
        user = await user_service.register_with_password(
            nickname=req.nickname,
            account=req.account,
            password=req.password,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    resp = _make_token(user)
    resp.is_new_user = True
    return resp


@router.post("/login/password", response_model=TokenResponse)
async def login_password(req: PasswordLoginRequest):
    """账号密码登录"""
    user = await user_service.login_by_password(req.account, req.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="账号或密码错误",
        )
    return _make_token(user)


@router.post("/sms/send")
async def send_sms(req: SmsSendRequest):
    """
    发送短信验证码

    TODO: 接入真实短信服务商（阿里云 / 腾讯云）。
          当前为开发模式，验证码直接在响应中返回，生产环境需去掉 debug_code 字段。
    """
    code = _generate_code()
    _save_code(req.phone, code)
    # TODO: 调用短信服务发送 code 到 req.phone
    return {
        "message": "验证码已发送",
        "debug_code": code,   # 仅开发模式，生产删除
    }


@router.post("/login/sms", response_model=TokenResponse)
async def login_sms(req: SmsLoginRequest):
    """手机验证码登录（手机号必须已绑定账号）"""
    if not _verify_code(req.phone, req.code):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="验证码错误或已过期",
        )

    user = await user_service.get_user_by_phone(req.phone)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="该手机号尚未绑定账号，请先注册",
        )
    return _make_token(user)


@router.post("/login/wechat", response_model=TokenResponse)
async def login_wechat(req: WechatLoginRequest):
    """
    微信网页扫码登录

    前端完成微信 OAuth2 授权后，将 openid（必须）和 unionid（可选）
    连同用户信息一起传入。新用户自动完成注册。
    """
    user, is_new = await user_service.get_or_create_wechat_user(
        openid=req.openid,
        nickname=req.nickname,
        avatar_url=req.avatar_url,
        unionid=req.unionid,
    )
    resp = _make_token(user)
    resp.is_new_user = is_new
    return resp
