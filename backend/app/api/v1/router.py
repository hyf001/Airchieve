from fastapi import APIRouter

from app.api.v1 import account_api, membership_api, payment_api

api_router = APIRouter()
api_router.include_router(account_api.router, prefix="/account", tags=["account"])
api_router.include_router(membership_api.router, prefix="/membership", tags=["membership"])
api_router.include_router(membership_api.admin_router, prefix="/admin/membership", tags=["admin-membership"])
api_router.include_router(payment_api.router, prefix="/payment", tags=["payment"])
