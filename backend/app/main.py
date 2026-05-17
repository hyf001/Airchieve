from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.db.session import init_db


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    await init_db()
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        debug=settings.DEBUG,
        version=settings.VERSION,
        lifespan=lifespan,
    )

    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    @app.get("/health", tags=["health"])
    async def health() -> JSONResponse:
        return JSONResponse({"status": "ok", "service": settings.PROJECT_NAME})

    return app


app = create_app()
