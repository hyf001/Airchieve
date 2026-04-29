"""
API V1 Router
API V1 路由聚合
"""
from fastapi import APIRouter

from app.api.v1.auth_api import router as auth_router
from app.api.v1.user_api import router as user_router
from app.api.v1.storybook_api import router as storybook_router
from app.api.v1.template_api import router as template_router
from app.api.v1.image_style_api import asset_router as image_style_asset_router
from app.api.v1.image_style_api import router as image_style_router
from app.api.v1.payment_api import router as payment_router
from app.api.v1.oss_api import router as oss_router
from app.api.v1.page_api import router as page_router
from app.api.v1.generation_debug_api import router as generation_debug_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(user_router)
api_router.include_router(storybook_router, tags=["storybooks"])
api_router.include_router(template_router, tags=["templates"])
api_router.include_router(image_style_router, tags=["image-styles"])
api_router.include_router(image_style_asset_router, tags=["image-style-assets"])
api_router.include_router(payment_router)
api_router.include_router(oss_router)
api_router.include_router(page_router)
api_router.include_router(generation_debug_router, tags=["generation-debug"])


# 健康检查
@api_router.get("/ping")
async def ping():
    """健康检查"""
    return {"message": "pong"}
