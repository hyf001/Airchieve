"""
Database Session
数据库会话管理
"""
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings


# 根据环境创建引擎配置
def get_engine_args() -> dict:
    """获取数据库引擎参数"""
    if settings.DATABASE_URL.startswith("sqlite"):
        # SQLite 开发环境配置
        return {
            "echo": settings.DEBUG,
            "future": True,
        }
    else:
        # MySQL 生产环境配置
        return {
            "echo": settings.DEBUG,
            "future": True,
            "poolclass": NullPool,  # 异步环境推荐使用 NullPool
        }


# 创建异步引擎
engine = create_async_engine(settings.DATABASE_URL, **get_engine_args())

# 创建异步会话工厂
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """获取数据库会话（依赖注入用）"""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """初始化数据库（创建所有表）"""
    from app.db.base import Base

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db() -> None:
    """关闭数据库连接"""
    await engine.dispose()
