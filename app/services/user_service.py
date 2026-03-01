"""
User Service
用户身份服务（Identity Domain）

职责：
  - 账号密码注册 / 登录
  - 手机号绑定（短信验证码在调用方校验，此处只处理持久化）
  - 微信网页扫码：get_or_create_wechat_user
  - 用户信息查询 / 资料更新
"""
from datetime import datetime, timezone

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash, verify_password
from app.db.session import async_session_maker
from app.models.user import AuthType, User, UserAuth


# ---------------------------------------------------------------------------
# 内部辅助
# ---------------------------------------------------------------------------

async def _create_user(session: AsyncSession, nickname: str, avatar_url: str | None = None) -> User:
    """创建用户主记录（事务内使用）"""
    user = User(nickname=nickname, avatar_url=avatar_url)
    session.add(user)
    await session.flush()  # 获取 id，不提交事务
    return user


async def _add_auth(
    session: AsyncSession,
    user_id: int,
    auth_type: AuthType,
    identifier: str,
    credential: str | None = None,
    wechat_unionid: str | None = None,
) -> UserAuth:
    """添加认证记录（事务内使用）"""
    auth = UserAuth(
        user_id=user_id,
        auth_type=auth_type,
        identifier=identifier,
        credential=credential,
        wechat_unionid=wechat_unionid,
    )
    session.add(auth)
    return auth


# ---------------------------------------------------------------------------
# 账号密码
# ---------------------------------------------------------------------------

async def register_with_password(nickname: str, account: str, password: str) -> User:
    """
    账号密码注册

    Raises:
        ValueError: 账号已被注册
    """
    async with async_session_maker() as session:
        # 检查账号是否已存在
        existing = (
            await session.execute(
                select(UserAuth).where(
                    UserAuth.auth_type == AuthType.password,
                    UserAuth.identifier == account,
                )
            )
        ).scalar_one_or_none()

        if existing:
            raise ValueError(f"账号 {account!r} 已存在")

        user = await _create_user(session, nickname)
        await _add_auth(
            session, user.id,
            auth_type=AuthType.password,
            identifier=account,
            credential=get_password_hash(password),
        )
        await session.commit()
        await session.refresh(user)
        return user


async def login_by_password(account: str, password: str) -> User | None:
    """
    账号密码登录

    Returns:
        User 对象；账号不存在或密码错误返回 None
    """
    async with async_session_maker() as session:
        auth = (
            await session.execute(
                select(UserAuth).where(
                    UserAuth.auth_type == AuthType.password,
                    UserAuth.identifier == account,
                    UserAuth.is_active == True,
                )
            )
        ).scalar_one_or_none()

        if auth is None or not verify_password(password, auth.credential or ""):
            return None

        user = (
            await session.execute(select(User).where(User.id == auth.user_id))
        ).scalar_one_or_none()

        if user is None or user.status != "active":
            return None

        # 记录最后登录时间
        user.updated_at = datetime.now(timezone.utc)
        await session.commit()
        await session.refresh(user)
        return user


# ---------------------------------------------------------------------------
# 手机短信
# ---------------------------------------------------------------------------

async def get_user_by_phone(phone: str) -> User | None:
    """通过手机号查找用户（短信验证码由调用方验证后调此函数）"""
    async with async_session_maker() as session:
        auth = (
            await session.execute(
                select(UserAuth).where(
                    UserAuth.auth_type == AuthType.sms,
                    UserAuth.identifier == phone,
                    UserAuth.is_active == True,
                )
            )
        ).scalar_one_or_none()

        if auth is None:
            return None

        user = (
            await session.execute(select(User).where(User.id == auth.user_id))
        ).scalar_one_or_none()

        if user is None or user.status != "active":
            return None

        user.updated_at = datetime.now(timezone.utc)
        await session.commit()
        await session.refresh(user)
        return user


async def bind_phone(user_id: int, phone: str) -> None:
    """
    绑定手机号（短信验证码由调用方验证）

    Raises:
        ValueError: 手机号已被其他账号绑定
    """
    async with async_session_maker() as session:
        existing = (
            await session.execute(
                select(UserAuth).where(
                    UserAuth.auth_type == AuthType.sms,
                    UserAuth.identifier == phone,
                )
            )
        ).scalar_one_or_none()

        if existing and existing.user_id != user_id:
            raise ValueError("该手机号已被其他账号绑定")

        if existing and existing.user_id == user_id:
            return  # 已绑定，幂等

        await _add_auth(
            session, user_id,
            auth_type=AuthType.sms,
            identifier=phone,
        )
        await session.commit()


# ---------------------------------------------------------------------------
# 微信网页扫码
# ---------------------------------------------------------------------------

async def get_or_create_wechat_user(
    openid: str,
    nickname: str,
    avatar_url: str | None = None,
    unionid: str | None = None,
) -> tuple[User, bool]:
    """
    微信网页扫码登录：找到则返回，否则自动注册

    Returns:
        (User, is_new_user): is_new_user=True 表示本次是新注册
    """
    async with async_session_maker() as session:
        auth = (
            await session.execute(
                select(UserAuth).where(
                    UserAuth.auth_type == AuthType.wechat_web,
                    UserAuth.identifier == openid,
                    UserAuth.is_active == True,
                )
            )
        ).scalar_one_or_none()

        if auth:
            # 已有账号，更新 unionid（可能首次带回）
            if unionid and auth.wechat_unionid != unionid:
                auth.wechat_unionid = unionid
            user = (
                await session.execute(select(User).where(User.id == auth.user_id))
            ).scalar_one()
            user.updated_at = datetime.now(timezone.utc)
            await session.commit()
            await session.refresh(user)
            return user, False

        # 新用户：创建 User + UserAuth
        user = await _create_user(session, nickname, avatar_url)
        await _add_auth(
            session, user.id,
            auth_type=AuthType.wechat_web,
            identifier=openid,
            wechat_unionid=unionid,
        )
        await session.commit()
        await session.refresh(user)
        return user, True


# ---------------------------------------------------------------------------
# 查询 / 更新资料
# ---------------------------------------------------------------------------

async def get_user(user_id: int) -> User | None:
    """按 ID 查询用户"""
    async with async_session_maker() as session:
        return (
            await session.execute(select(User).where(User.id == user_id))
        ).scalar_one_or_none()


async def list_users(
    page: int = 1,
    size: int = 20,
    search: str | None = None,
) -> tuple[list[User], int]:
    """管理员：分页查询用户列表，支持按昵称或 ID 搜索"""
    async with async_session_maker() as session:
        base = select(User)
        if search:
            like_pat = f"%{search}%"
            if search.isdigit():
                base = base.where(or_(User.nickname.like(like_pat), User.id == int(search)))
            else:
                base = base.where(User.nickname.like(like_pat))

        total: int = (
            await session.execute(
                select(func.count()).select_from(base.subquery())
            )
        ).scalar_one()

        users = (
            await session.execute(
                base.order_by(User.id.desc())
                .offset((page - 1) * size)
                .limit(size)
            )
        ).scalars().all()

        return list(users), total


async def admin_update_user(
    user_id: int,
    status: str | None = None,
    role: str | None = None,
) -> User | None:
    """管理员：更新用户状态或角色"""
    async with async_session_maker() as session:
        user = (
            await session.execute(select(User).where(User.id == user_id))
        ).scalar_one_or_none()

        if user is None:
            return None

        if status is not None:
            user.status = status
        if role is not None:
            user.role = role

        user.updated_at = datetime.now(timezone.utc)
        await session.commit()
        await session.refresh(user)
        return user


async def update_profile(
    user_id: int,
    nickname: str | None = None,
    avatar_url: str | None = None,
) -> User | None:
    """更新用户昵称 / 头像"""
    async with async_session_maker() as session:
        user = (
            await session.execute(select(User).where(User.id == user_id))
        ).scalar_one_or_none()

        if user is None:
            return None

        if nickname is not None:
            user.nickname = nickname
        if avatar_url is not None:
            user.avatar_url = avatar_url

        await session.commit()
        await session.refresh(user)
        return user
