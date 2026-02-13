"""
API V1 Router
API V1 路由聚合
"""
from fastapi import APIRouter

from app.api.v1.auth_api import router as auth_router
from app.api.v1.storybook_api import router as storybook_router
from app.api.v1.template_api import router as template_router

api_router = APIRouter()

# 注册认证路由
api_router.include_router(auth_router)

# 注册绘本路由
api_router.include_router(storybook_router, tags=["storybooks"])

# 注册模版路由
api_router.include_router(template_router, tags=["templates"])


# 健康检查
@api_router.get("/ping")
async def ping():
    """健康检查"""
    return {"message": "pong"}
