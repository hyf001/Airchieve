import base64
import hashlib
import hmac
import json
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.utils.sms import SmsSendError, send_verification_code
from app.model.account import (
    AccountAuthIdentity,
    AccountRiskChallenge,
    AccountSession,
    AuthIdentityStatus,
    AuthProvider,
    CaptchaProvider,
    LoginMethod,
    RiskChallengeStatus,
    SmsCodeStatus,
    SmsScene,
    SmsVerificationCode,
    User,
    UserStatus,
)
from app.schema.account import (
    AccountRegisterRequest,
    AuthBindingSummary,
    AuthTokenRead,
    CaptchaVerifyRequest,
    CaptchaVerifyResult,
    MembershipSummary,
    PhoneBindRequest,
    PhoneChangeRequest,
    PhoneLoginRequest,
    PasswordLoginRequest,
    PhoneUnbindRequest,
    SmsCodeSendRequest,
    SmsCodeSendResult,
    UserRead,
    WechatBindRequest,
    WechatLoginRequest,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _hash(value: str) -> str:
    return hmac.new(settings.SECRET_KEY.encode(), value.encode(), hashlib.sha256).hexdigest()


def _mask_phone(phone: str | None) -> str | None:
    if not phone:
        return None
    if len(phone) <= 7:
        return f"{phone[:2]}****{phone[-1:]}"
    return f"{phone[:3]}****{phone[-4:]}"


def _mask_identifier(phone: str) -> str:
    return _mask_phone(phone) or phone


def _normal_phone(phone: str) -> str:
    return phone.strip().replace(" ", "").replace("-", "")


def _normal_username(username: str) -> str:
    return username.strip().lower()


def _hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode(),
        f"{settings.SECRET_KEY}:{salt}".encode(),
        120_000,
    ).hex()
    return f"pbkdf2_sha256${salt}${digest}"


def _verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    try:
        algorithm, salt, digest = password_hash.split("$", 2)
    except ValueError:
        return False
    if algorithm != "pbkdf2_sha256":
        return False
    expected = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode(),
        f"{settings.SECRET_KEY}:{salt}".encode(),
        120_000,
    ).hex()
    return hmac.compare_digest(expected, digest)


def _require_policy_versions(terms_version: str | None, privacy_version: str | None) -> None:
    if not terms_version or not privacy_version:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请先同意用户协议和隐私政策")


def _sign_access_token(user_id: str, session_id: str) -> str:
    exp = int((_now() + timedelta(seconds=settings.ACCESS_TOKEN_EXPIRE_SECONDS)).timestamp())
    payload = {"sub": user_id, "sid": session_id, "exp": exp}
    body = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode()).decode().rstrip("=")
    sig = _hash(body)
    return f"{body}.{sig}"


def verify_access_token(token: str) -> tuple[str, str]:
    try:
        body, sig = token.split(".", 1)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录态无效") from exc
    if not hmac.compare_digest(_hash(body), sig):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录态无效")
    padded = body + "=" * (-len(body) % 4)
    payload = json.loads(base64.urlsafe_b64decode(padded.encode()).decode())
    if int(payload["exp"]) < int(_now().timestamp()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录已过期")
    return str(payload["sub"]), str(payload["sid"])


async def _serialize_user(db: AsyncSession, user: User) -> UserRead:
    identities = await db.execute(
        select(AccountAuthIdentity).where(
            AccountAuthIdentity.user_id == user.id,
            AccountAuthIdentity.status == AuthIdentityStatus.ACTIVE,
        )
    )
    wechat_bound = any(identity.provider == AuthProvider.WECHAT for identity in identities.scalars().all())
    return UserRead(
        id=user.id,
        display_name=user.display_name,
        avatar_url=None,
        role=user.role,
        status=user.status,
        default_child_profile_id=user.default_child_profile_id,
        phone_masked=_mask_phone(user.phone),
        wechat_bound=wechat_bound,
        membership_summary=MembershipSummary(),
    )


async def _get_user(db: AsyncSession, user_id: str) -> User:
    user = await db.get(User, user_id)
    if not user or user.status != UserStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="账号不可用")
    return user


async def _find_user_by_phone(db: AsyncSession, phone: str) -> User | None:
    result = await db.execute(select(User).where(User.phone == phone))
    return result.scalar_one_or_none()


async def _find_user_by_username(db: AsyncSession, username: str) -> User | None:
    result = await db.execute(select(User).where(User.username == _normal_username(username)))
    return result.scalar_one_or_none()


async def _find_active_phone_identity(db: AsyncSession, phone: str) -> AccountAuthIdentity | None:
    result = await db.execute(
        select(AccountAuthIdentity).where(
            AccountAuthIdentity.provider == AuthProvider.PHONE,
            AccountAuthIdentity.provider_user_id == phone,
            AccountAuthIdentity.status == AuthIdentityStatus.ACTIVE,
        )
    )
    return result.scalar_one_or_none()


async def _create_phone_identity(db: AsyncSession, user_id: str, phone: str) -> AccountAuthIdentity:
    existing = await _find_active_phone_identity(db, phone)
    if existing and existing.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="手机号已绑定其他账号")
    if existing:
        return existing
    identity = AccountAuthIdentity(
        user_id=user_id,
        provider=AuthProvider.PHONE,
        provider_app_id=None,
        provider_user_id=phone,
        display_name=_mask_phone(phone),
        bound_at=_now(),
        status=AuthIdentityStatus.ACTIVE,
    )
    db.add(identity)
    return identity


async def _issue_tokens(
    db: AsyncSession,
    user: User,
    login_method: LoginMethod,
    device_id: str | None = None,
    return_to: str | None = None,
    user_agent: str | None = None,
    ip: str | None = None,
) -> AuthTokenRead:
    if user.status != UserStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="账号已禁用")
    raw_refresh = secrets.token_urlsafe(48)
    session = AccountSession(
        user_id=user.id,
        refresh_token_hash=_hash(raw_refresh),
        login_method=login_method,
        device_id=device_id,
        user_agent=user_agent,
        ip=ip,
        return_to=return_to,
        expires_at=_now() + timedelta(seconds=settings.REFRESH_TOKEN_EXPIRE_SECONDS),
    )
    user.last_login_at = _now()
    db.add(session)
    await db.commit()
    await db.refresh(session)
    await db.refresh(user)
    return AuthTokenRead(
        access_token=_sign_access_token(user.id, session.id),
        refresh_token=raw_refresh,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_SECONDS,
        session_id=session.id,
        return_to=return_to,
        user=await _serialize_user(db, user),
    )


async def send_sms_code(db: AsyncSession, payload: SmsCodeSendRequest, user_id: str | None = None) -> SmsCodeSendResult:
    phone = _normal_phone(payload.phone)
    recent = await db.execute(
        select(SmsVerificationCode)
        .where(SmsVerificationCode.phone == phone, SmsVerificationCode.scene == payload.scene)
        .order_by(SmsVerificationCode.created_at.desc())
        .limit(1)
    )
    latest = recent.scalar_one_or_none()
    if latest:
        elapsed = (_now() - _as_aware(latest.created_at)).total_seconds()
        if elapsed < settings.SMS_CODE_COOLDOWN_SECONDS:
            return SmsCodeSendResult(
                cooldown_seconds=settings.SMS_CODE_COOLDOWN_SECONDS - int(elapsed),
                expires_in_seconds=max(0, int((_as_aware(latest.expires_at) - _now()).total_seconds())),
                masked_phone=_mask_phone(phone) or phone,
                dev_code="123456" if settings.DEBUG else None,
            )

    code = "123456" if settings.DEBUG else f"{secrets.randbelow(1_000_000):06d}"
    record = SmsVerificationCode(
        phone=phone,
        scene=payload.scene,
        code_hash=_hash(f"{phone}:{payload.scene}:{code}"),
        device_id=payload.device_id,
        captcha_ticket=payload.captcha_ticket,
        user_id=user_id,
        expires_at=_now() + timedelta(seconds=settings.SMS_CODE_EXPIRE_SECONDS),
    )
    db.add(record)
    try:
        await send_verification_code(phone, code)
        await db.commit()
    except SmsSendError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return SmsCodeSendResult(
        cooldown_seconds=settings.SMS_CODE_COOLDOWN_SECONDS,
        expires_in_seconds=settings.SMS_CODE_EXPIRE_SECONDS,
        masked_phone=_mask_phone(phone) or phone,
        dev_code=code if settings.DEBUG else None,
    )


async def assert_phone_code_valid(db: AsyncSession, phone: str, scene: SmsScene, code: str) -> None:
    phone = _normal_phone(phone)
    result = await db.execute(
        select(SmsVerificationCode)
        .where(
            SmsVerificationCode.phone == phone,
            SmsVerificationCode.scene == scene,
            SmsVerificationCode.status == SmsCodeStatus.PENDING,
        )
        .order_by(SmsVerificationCode.created_at.desc())
        .limit(1)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="验证码不存在或已使用")
    if _as_aware(record.expires_at) < _now():
        record.status = SmsCodeStatus.EXPIRED
        await db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="验证码已过期")
    if record.attempt_count >= 5:
        record.status = SmsCodeStatus.BLOCKED
        await db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="验证码尝试次数过多")
    if not hmac.compare_digest(record.code_hash, _hash(f"{phone}:{scene}:{code}")):
        record.attempt_count += 1
        await db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="验证码错误")
    record.status = SmsCodeStatus.VERIFIED
    record.verified_at = _now()
    await db.flush()


async def register_with_phone(db: AsyncSession, payload: AccountRegisterRequest) -> AuthTokenRead:
    phone = _normal_phone(payload.phone)
    username = _normal_username(payload.username) if payload.username else None
    _require_policy_versions(payload.terms_version, payload.privacy_version)
    await assert_phone_code_valid(db, phone, SmsScene.REGISTER, payload.sms_code)
    if await _find_user_by_phone(db, phone):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="手机号已注册")
    if bool(username) != bool(payload.password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用户名和密码必须同时填写")
    if username and await _find_user_by_username(db, username):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="用户名已注册")
    user = User(
        username=username,
        password_hash=_hash_password(payload.password) if payload.password else None,
        phone=phone,
        phone_verified_at=_now(),
        display_name=payload.display_name or payload.username or f"用户{phone[-4:]}",
        terms_accepted_at=_now(),
        privacy_accepted_at=_now(),
        terms_version=payload.terms_version,
        privacy_version=payload.privacy_version,
    )
    db.add(user)
    await db.flush()
    await _create_phone_identity(db, user.id, phone)
    return await _issue_tokens(db, user, LoginMethod.REGISTER)


async def login_with_password(db: AsyncSession, payload: PasswordLoginRequest) -> AuthTokenRead:
    user = await _find_user_by_username(db, payload.username)
    if not user or not _verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")
    return await _issue_tokens(db, user, LoginMethod.PASSWORD, device_id=payload.device_id, return_to=payload.return_to)


async def login_with_phone(db: AsyncSession, payload: PhoneLoginRequest) -> AuthTokenRead:
    phone = _normal_phone(payload.phone)
    await assert_phone_code_valid(db, phone, SmsScene.PHONE_LOGIN, payload.sms_code)
    user = await _find_user_by_phone(db, phone)
    login_method = LoginMethod.PHONE_CODE
    if not user:
        if not payload.auto_register:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="手机号未注册")
        _require_policy_versions(payload.terms_version, payload.privacy_version)
        user = User(
            phone=phone,
            phone_verified_at=_now(),
            display_name=f"用户{phone[-4:]}",
            terms_accepted_at=_now(),
            privacy_accepted_at=_now(),
            terms_version=payload.terms_version,
            privacy_version=payload.privacy_version,
        )
        db.add(user)
        await db.flush()
        await _create_phone_identity(db, user.id, phone)
        login_method = LoginMethod.REGISTER
    if user.status != UserStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="账号已禁用")
    await db.execute(
        update(AccountAuthIdentity)
        .where(
            AccountAuthIdentity.user_id == user.id,
            AccountAuthIdentity.provider == AuthProvider.PHONE,
            AccountAuthIdentity.status == AuthIdentityStatus.ACTIVE,
        )
        .values(last_login_at=_now())
    )
    return await _issue_tokens(db, user, login_method, device_id=payload.device_id, return_to=payload.return_to)


def _wechat_identity_from_code(payload: WechatLoginRequest | WechatBindRequest) -> tuple[str, str]:
    digest = hashlib.sha256(f"{payload.provider_app_id}:{payload.code}".encode()).hexdigest()
    return f"openid_{digest[:24]}", f"union_{digest[24:48]}"


async def login_with_wechat(db: AsyncSession, payload: WechatLoginRequest) -> AuthTokenRead:
    provider_user_id, union_id = _wechat_identity_from_code(payload)
    result = await db.execute(
        select(AccountAuthIdentity).where(
            AccountAuthIdentity.provider == AuthProvider.WECHAT,
            AccountAuthIdentity.status == AuthIdentityStatus.ACTIVE,
            or_(
                AccountAuthIdentity.union_id == union_id,
                (AccountAuthIdentity.provider_app_id == payload.provider_app_id)
                & (AccountAuthIdentity.provider_user_id == provider_user_id),
            ),
        )
    )
    identity = result.scalar_one_or_none()
    if identity:
        user = await _get_user(db, identity.user_id)
        identity.last_login_at = _now()
    else:
        _require_policy_versions(payload.terms_version, payload.privacy_version)
        user = User(
            display_name="微信用户",
            terms_accepted_at=_now(),
            privacy_accepted_at=_now(),
            terms_version=payload.terms_version,
            privacy_version=payload.privacy_version,
        )
        db.add(user)
        await db.flush()
        identity = AccountAuthIdentity(
            user_id=user.id,
            provider=AuthProvider.WECHAT,
            provider_app_id=payload.provider_app_id,
            provider_user_id=provider_user_id,
            union_id=union_id,
            display_name="微信用户",
            bound_at=_now(),
            last_login_at=_now(),
        )
        db.add(identity)
    return await _issue_tokens(db, user, LoginMethod.WECHAT, device_id=payload.device_id, return_to=payload.return_to)


async def refresh_session(db: AsyncSession, refresh_token: str) -> AuthTokenRead:
    token_hash = _hash(refresh_token)
    result = await db.execute(
        select(AccountSession).where(
            AccountSession.refresh_token_hash == token_hash,
            AccountSession.revoked_at.is_(None),
        )
    )
    session = result.scalar_one_or_none()
    if not session or _as_aware(session.expires_at) < _now():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="刷新登录态已过期")
    user = await _get_user(db, session.user_id)
    raw_refresh = secrets.token_urlsafe(48)
    session.refresh_token_hash = _hash(raw_refresh)
    session.expires_at = _now() + timedelta(seconds=settings.REFRESH_TOKEN_EXPIRE_SECONDS)
    await db.commit()
    return AuthTokenRead(
        access_token=_sign_access_token(user.id, session.id),
        refresh_token=raw_refresh,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_SECONDS,
        session_id=session.id,
        return_to=session.return_to,
        user=await _serialize_user(db, user),
    )


async def logout(db: AsyncSession, session_id: str) -> None:
    session = await db.get(AccountSession, session_id)
    if session and not session.revoked_at:
        session.revoked_at = _now()
        await db.commit()


async def verify_captcha(db: AsyncSession, payload: CaptchaVerifyRequest) -> CaptchaVerifyResult:
    challenge = await db.get(AccountRiskChallenge, payload.challenge_id)
    if not challenge or challenge.status != RiskChallengeStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="真人验证挑战不存在")
    if _as_aware(challenge.expires_at) < _now():
        challenge.status = RiskChallengeStatus.EXPIRED
        await db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="真人验证已过期")
    if payload.provider not in {CaptchaProvider.SLIDER, CaptchaProvider.SILENT, CaptchaProvider.IMAGE, CaptchaProvider.THIRD_PARTY}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="真人验证方式不支持")
    ticket = secrets.token_urlsafe(32)
    challenge.ticket_hash = _hash(ticket)
    challenge.status = RiskChallengeStatus.PASSED
    challenge.verified_at = _now()
    challenge.device_id = payload.device_id or challenge.device_id
    await db.commit()
    return CaptchaVerifyResult(captcha_ticket=ticket, expires_in_seconds=600)


async def get_current_user(db: AsyncSession, user_id: str) -> UserRead:
    return await _serialize_user(db, await _get_user(db, user_id))


async def list_auth_bindings(db: AsyncSession, user_id: str) -> list[AuthBindingSummary]:
    identities = await db.execute(
        select(AccountAuthIdentity).where(
            AccountAuthIdentity.user_id == user_id,
            AccountAuthIdentity.status == AuthIdentityStatus.ACTIVE,
        )
    )
    rows = list(identities.scalars().all())
    return [
        AuthBindingSummary(
            provider=row.provider,
            masked_identifier=_mask_identifier(row.provider_user_id)
            if row.provider == AuthProvider.PHONE
            else f"{row.provider.value}:{row.provider_user_id[:8]}...",
            bound_at=row.bound_at,
            last_login_at=row.last_login_at,
            can_unbind=len(rows) > 1,
        )
        for row in rows
    ]


async def assert_login_method_remains(db: AsyncSession, user_id: str, excluding_identity_id: str | None = None) -> None:
    query = select(func.count(AccountAuthIdentity.id)).where(
        AccountAuthIdentity.user_id == user_id,
        AccountAuthIdentity.status == AuthIdentityStatus.ACTIVE,
    )
    if excluding_identity_id:
        query = query.where(AccountAuthIdentity.id != excluding_identity_id)
    count = (await db.execute(query)).scalar_one()
    if count < 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="账号需保留至少一种登录方式")


async def bind_phone(db: AsyncSession, user_id: str, payload: PhoneBindRequest) -> UserRead:
    user = await _get_user(db, user_id)
    phone = _normal_phone(payload.phone)
    await assert_phone_code_valid(db, phone, SmsScene.BIND_PHONE, payload.sms_code)
    existing_user = await _find_user_by_phone(db, phone)
    if existing_user and existing_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="手机号已绑定其他账号")
    user.phone = phone
    user.phone_verified_at = _now()
    await _create_phone_identity(db, user_id, phone)
    await db.commit()
    await db.refresh(user)
    return await _serialize_user(db, user)


async def change_phone(db: AsyncSession, user_id: str, payload: PhoneChangeRequest) -> UserRead:
    user = await _get_user(db, user_id)
    if not user.phone:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="当前账号未绑定手机号")
    await assert_phone_code_valid(db, user.phone, SmsScene.CHANGE_PHONE, payload.old_phone_sms_code)
    return await bind_phone(db, user_id, PhoneBindRequest(phone=payload.new_phone, sms_code=payload.new_phone_sms_code))


async def unbind_phone(db: AsyncSession, user_id: str, payload: PhoneUnbindRequest) -> UserRead:
    user = await _get_user(db, user_id)
    if not user.phone:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="当前账号未绑定手机号")
    await assert_phone_code_valid(db, user.phone, SmsScene.UNBIND_PHONE, payload.sms_code)
    identity = await _find_active_phone_identity(db, user.phone)
    await assert_login_method_remains(db, user_id, excluding_identity_id=identity.id if identity else None)
    if identity:
        identity.status = AuthIdentityStatus.UNBOUND
    user.phone = None
    user.phone_verified_at = None
    await db.commit()
    await db.refresh(user)
    return await _serialize_user(db, user)


async def bind_wechat(db: AsyncSession, user_id: str, payload: WechatBindRequest) -> UserRead:
    user = await _get_user(db, user_id)
    provider_user_id, union_id = _wechat_identity_from_code(payload)
    result = await db.execute(
        select(AccountAuthIdentity).where(
            AccountAuthIdentity.provider == AuthProvider.WECHAT,
            AccountAuthIdentity.status == AuthIdentityStatus.ACTIVE,
            or_(
                AccountAuthIdentity.union_id == union_id,
                (AccountAuthIdentity.provider_app_id == payload.provider_app_id)
                & (AccountAuthIdentity.provider_user_id == provider_user_id),
            ),
        )
    )
    existing = result.scalar_one_or_none()
    if existing and existing.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="微信已绑定其他账号")
    if not existing:
        db.add(
            AccountAuthIdentity(
                user_id=user_id,
                provider=AuthProvider.WECHAT,
                provider_app_id=payload.provider_app_id,
                provider_user_id=provider_user_id,
                union_id=union_id,
                display_name="微信用户",
                bound_at=_now(),
            )
        )
    await db.commit()
    await db.refresh(user)
    return await _serialize_user(db, user)


async def change_wechat(db: AsyncSession, user_id: str, payload: WechatBindRequest) -> UserRead:
    await _get_user(db, user_id)
    identities = await db.execute(
        select(AccountAuthIdentity).where(
            AccountAuthIdentity.user_id == user_id,
            AccountAuthIdentity.provider == AuthProvider.WECHAT,
            AccountAuthIdentity.status == AuthIdentityStatus.ACTIVE,
        )
    )
    for identity in identities.scalars().all():
        identity.status = AuthIdentityStatus.UNBOUND
    return await bind_wechat(db, user_id, payload)


async def unbind_wechat(db: AsyncSession, user_id: str, identity_id: str | None = None) -> UserRead:
    user = await _get_user(db, user_id)
    query = select(AccountAuthIdentity).where(
        AccountAuthIdentity.user_id == user_id,
        AccountAuthIdentity.provider == AuthProvider.WECHAT,
        AccountAuthIdentity.status == AuthIdentityStatus.ACTIVE,
    )
    if identity_id:
        query = query.where(AccountAuthIdentity.id == identity_id)
    result = await db.execute(query)
    identity = result.scalar_one_or_none()
    if not identity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="微信绑定不存在")
    await assert_login_method_remains(db, user_id, excluding_identity_id=identity.id)
    identity.status = AuthIdentityStatus.UNBOUND
    await db.commit()
    await db.refresh(user)
    return await _serialize_user(db, user)


async def assert_phone_bound(db: AsyncSession, user_id: str) -> None:
    user = await _get_user(db, user_id)
    if not user.phone:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="请先绑定手机号")
