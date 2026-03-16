from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.db import init_db, close_db
from app.services.llm_cli import LLMError


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: 初始化数据库
    await init_db()
    yield
    # Shutdown: 关闭数据库连接
    await close_db()


app = FastAPI(
    title="Airchieve",
    version=settings.VERSION,
    description=settings.DESCRIPTION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)


@app.exception_handler(LLMError)
async def llm_error_handler(_request: Request, exc: LLMError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={"code": exc.error_type, "message": exc.user_message},
    )

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
