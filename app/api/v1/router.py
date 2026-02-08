"""
API V1 Router
API V1 路由聚合
"""
from fastapi import APIRouter

from app.api.v1.auth_api import router as auth_router
from app.api.v1.gemini_api import router as gemini_router
from app.api.v1.storybook_api import router as storybook_router

api_router = APIRouter()

# 注册认证路由
api_router.include_router(auth_router)

# 注册 Gemini 绘本路由
api_router.include_router(gemini_router, prefix="/gemini", tags=["gemini"])

# 注册绘本路由
api_router.include_router(storybook_router, tags=["storybooks"])


# 健康检查
@api_router.get("/ping")
async def ping():
    """健康检查"""
    return {"message": "pong"}
