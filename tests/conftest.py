from collections.abc import AsyncGenerator

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.model.base import Base


@pytest.fixture(scope="session")
def engine():
    return create_async_engine("sqlite+aiosqlite://", echo=False)


@pytest.fixture(scope="session")
async def setup_tables(engine):
    import app.model  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def db(engine, setup_tables) -> AsyncGenerator[AsyncSession, None]:
    session_maker = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with session_maker() as session:
        yield session
        await session.rollback()
