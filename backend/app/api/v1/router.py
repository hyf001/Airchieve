from fastapi import APIRouter

from app.api.v1 import account_api, item_api

api_router = APIRouter()
api_router.include_router(account_api.router, prefix="/account", tags=["account"])
api_router.include_router(item_api.router, prefix="/items", tags=["items"])
