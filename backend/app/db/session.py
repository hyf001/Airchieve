from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.model.base import Base

engine = create_async_engine(settings.DATABASE_URL, pool_pre_ping=True)
async_session_maker = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session


async def init_db() -> None:
    # Import models before create_all so SQLAlchemy has registered table metadata.
    import app.model  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
