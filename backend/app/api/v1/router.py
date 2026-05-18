from fastapi import APIRouter

from app.api.v1 import account_api, admin_api, book_api, membership_api, payment_api, recommendation_api, story_api, taxonomy_api

api_router = APIRouter()
api_router.include_router(account_api.router, prefix="/account", tags=["account"])
api_router.include_router(book_api.router, prefix="/books", tags=["books"])
api_router.include_router(membership_api.router, prefix="/membership", tags=["membership"])
api_router.include_router(membership_api.admin_router, prefix="/admin/membership", tags=["admin-membership"])
api_router.include_router(recommendation_api.router, prefix="/recommendations", tags=["recommendations"])
api_router.include_router(story_api.router, prefix="/stories", tags=["stories"])
api_router.include_router(payment_api.router, prefix="/payment", tags=["payment"])
api_router.include_router(admin_api.router, prefix="/admin", tags=["admin"])
api_router.include_router(taxonomy_api.router, prefix="/taxonomy", tags=["taxonomy"])
api_router.include_router(taxonomy_api.admin_router, prefix="/admin/taxonomy", tags=["admin-taxonomy"])
