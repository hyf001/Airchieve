from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.model.account import User, UserRole
from app.schema.account import (
    AccountRegisterRequest,
    AuthBindingSummary,
    AuthTokenRead,
    CaptchaVerifyRequest,
    CaptchaVerifyResult,
    ChildProfileCreate,
    ChildProfileRead,
    ChildProfileUpdate,
    PhoneBindRequest,
    PhoneChangeRequest,
    PhoneLoginRequest,
    PasswordLoginRequest,
    PhoneUnbindRequest,
    RefreshTokenRequest,
    SmsCodeSendRequest,
    SmsCodeSendResult,
    UserRead,
    WechatBindRequest,
    WechatLoginRequest,
)
from app.service import account as account_service

router = APIRouter()


async def current_session(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> tuple[int, int]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="请先登录")
    return await account_service.verify_active_session(db, authorization.split(" ", 1)[1])


async def current_user_id(session: tuple[int, int] = Depends(current_session)) -> int:
    return session[0]


async def optional_current_user_id(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> int | None:
    if not authorization:
        return None
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="请先登录")
    user_id, _ = await account_service.verify_active_session(db, authorization.split(" ", 1)[1])
    return user_id


async def current_admin_user_id(
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> int:
    user = await db.get(User, user_id)
    if user is None or user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="需要管理员权限")
    return user_id


@router.post("/auth/register", response_model=AuthTokenRead, status_code=status.HTTP_201_CREATED)
async def register_with_phone(
    payload: AccountRegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> AuthTokenRead:
    return await account_service.register_with_phone(db, payload)


@router.post("/auth/sms-code", response_model=SmsCodeSendResult)
async def send_sms_code(
    payload: SmsCodeSendRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int | None = Depends(lambda: None),
) -> SmsCodeSendResult:
    return await account_service.send_sms_code(db, payload, user_id=user_id)


@router.post("/auth/phone-login", response_model=AuthTokenRead)
async def login_with_phone(
    payload: PhoneLoginRequest,
    db: AsyncSession = Depends(get_db),
) -> AuthTokenRead:
    return await account_service.login_with_phone(db, payload)


@router.post("/auth/password-login", response_model=AuthTokenRead)
async def login_with_password(
    payload: PasswordLoginRequest,
    db: AsyncSession = Depends(get_db),
) -> AuthTokenRead:
    return await account_service.login_with_password(db, payload)


@router.post("/auth/wechat-login", response_model=AuthTokenRead)
async def login_with_wechat(
    payload: WechatLoginRequest,
    db: AsyncSession = Depends(get_db),
) -> AuthTokenRead:
    return await account_service.login_with_wechat(db, payload)


@router.post("/auth/refresh", response_model=AuthTokenRead)
async def refresh_session(
    payload: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
) -> AuthTokenRead:
    return await account_service.refresh_session(db, payload.refresh_token)


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    db: AsyncSession = Depends(get_db),
    session: tuple[int, int] = Depends(current_session),
) -> Response:
    await account_service.logout(db, session[1])
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/auth/captcha/verify", response_model=CaptchaVerifyResult)
async def verify_captcha(
    payload: CaptchaVerifyRequest,
    db: AsyncSession = Depends(get_db),
) -> CaptchaVerifyResult:
    return await account_service.verify_captcha(db, payload)


@router.get("/me", response_model=UserRead)
async def get_me(
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> UserRead:
    return await account_service.get_current_user(db, user_id)


@router.get("/bindings", response_model=list[AuthBindingSummary])
async def list_bindings(
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> list[AuthBindingSummary]:
    return await account_service.list_auth_bindings(db, user_id)


@router.post("/phone/bind", response_model=UserRead)
async def bind_phone(
    payload: PhoneBindRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> UserRead:
    return await account_service.bind_phone(db, user_id, payload)


@router.post("/phone/change", response_model=UserRead)
async def change_phone(
    payload: PhoneChangeRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> UserRead:
    return await account_service.change_phone(db, user_id, payload)


@router.delete("/phone", response_model=UserRead)
async def unbind_phone(
    payload: PhoneUnbindRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> UserRead:
    return await account_service.unbind_phone(db, user_id, payload)


@router.post("/wechat/bind", response_model=UserRead)
async def bind_wechat(
    payload: WechatBindRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> UserRead:
    return await account_service.bind_wechat(db, user_id, payload)


@router.post("/wechat/change", response_model=UserRead)
async def change_wechat(
    payload: WechatBindRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> UserRead:
    return await account_service.change_wechat(db, user_id, payload)


@router.delete("/wechat", response_model=UserRead)
async def unbind_wechat(
    identity_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> UserRead:
    return await account_service.unbind_wechat(db, user_id, identity_id=identity_id)


@router.get("/child-profiles", response_model=list[ChildProfileRead])
async def list_child_profiles(
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> list[ChildProfileRead]:
    return await account_service.list_child_profiles(db, user_id)


@router.post("/child-profiles", response_model=ChildProfileRead, status_code=status.HTTP_201_CREATED)
async def create_child_profile(
    payload: ChildProfileCreate,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> ChildProfileRead:
    return await account_service.create_child_profile(db, user_id, payload)


@router.get("/child-profiles/{profile_id}", response_model=ChildProfileRead)
async def get_child_profile(
    profile_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> ChildProfileRead:
    return await account_service.get_child_profile(db, user_id, profile_id)


@router.patch("/child-profiles/{profile_id}", response_model=ChildProfileRead)
async def update_child_profile(
    profile_id: int,
    payload: ChildProfileUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> ChildProfileRead:
    return await account_service.update_child_profile(db, user_id, profile_id, payload)


@router.delete("/child-profiles/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_child_profile(
    profile_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> Response:
    await account_service.delete_child_profile(db, user_id, profile_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/child-profiles/{profile_id}/default", response_model=ChildProfileRead)
async def set_default_child_profile(
    profile_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> ChildProfileRead:
    return await account_service.set_default_child_profile(db, user_id, profile_id)
