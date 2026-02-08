"""
API V1 Router
API V1 路由聚合
"""
from fastapi import APIRouter

from app.api.v1.auth_api import router as auth_router
from app.api.v1.projects_api import router as projects_router
from app.api.v1.chat_api import router as chat_router
from app.api.v1.gemini_api import router as gemini_router

api_router = APIRouter()

# 注册认证路由
api_router.include_router(auth_router)

# 注册项目路由
api_router.include_router(projects_router, prefix="/projects", tags=["projects"])

# 注册聊天路由
api_router.include_router(chat_router, prefix="/chat", tags=["chat"])

# 注册 Gemini 绘本路由
api_router.include_router(gemini_router, prefix="/gemini", tags=["gemini"])


# 健康检查
@api_router.get("/ping")
async def ping():
    """健康检查"""
    return {"message": "pong"}
