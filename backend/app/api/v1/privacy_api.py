from fastapi import APIRouter, Depends, Header, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.account_api import current_user_id
from app.db.session import get_db
from app.model.privacy import PrivacyAction
from app.schema.privacy import (
    PrivacyConfirmationCreate,
    PrivacyConfirmationRead,
    PrivacyFlagsRead,
    PrivacyTarget,
    UploadConsentCreate,
    UploadConsentRead,
)
from app.service.privacy import service as privacy

router = APIRouter()


@router.post("/upload-consents", response_model=UploadConsentRead, status_code=status.HTTP_201_CREATED)
async def record_upload_consent(
    payload: UploadConsentCreate,
    db: AsyncSession = Depends(get_db),
    user_agent: str | None = Header(default=None),
    user_id: int = Depends(current_user_id),
) -> UploadConsentRead:
    return await privacy.record_upload_consent(db, user_id, payload, user_agent=user_agent)


@router.post("/confirmations", response_model=PrivacyConfirmationRead, status_code=status.HTTP_201_CREATED)
async def record_privacy_confirmation(
    payload: PrivacyConfirmationCreate,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> PrivacyConfirmationRead:
    return await privacy.record_privacy_confirmation(db, user_id, payload)


@router.get("/flags", response_model=PrivacyFlagsRead)
async def get_privacy_flags(
    target_type: str = Query(min_length=1, max_length=80),
    target_id: int = Query(ge=1),
    action: PrivacyAction | None = None,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> PrivacyFlagsRead:
    return await privacy.get_privacy_flags(db, PrivacyTarget(target_type=target_type, target_id=target_id), user_id=user_id, action=action)
