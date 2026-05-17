from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.account_api import current_user_id
from app.db.session import get_db
from app.model.payment import PaymentProvider
from app.schema.payment import (
    CreateMembershipOrderRequest,
    PaymentCallbackPayload,
    PaymentCallbackResult,
    PaymentOrderRead,
    PaymentRecordRead,
)
from app.service import payment as payment_service

router = APIRouter()


@router.post("/membership-orders", response_model=PaymentOrderRead, status_code=status.HTTP_201_CREATED)
async def create_membership_order(
    payload: CreateMembershipOrderRequest,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> PaymentOrderRead:
    return await payment_service.create_membership_order(db, user_id, payload)


@router.get("/orders/{order_id}", response_model=PaymentOrderRead)
async def get_payment_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> PaymentOrderRead:
    return await payment_service.get_payment_order(db, user_id, order_id)


@router.get("/records", response_model=list[PaymentRecordRead])
async def list_payment_records(
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(current_user_id),
) -> list[PaymentRecordRead]:
    return await payment_service.list_user_payment_records(db, user_id)


@router.post("/callbacks/{provider}", response_model=PaymentCallbackResult)
async def handle_payment_callback(
    provider: PaymentProvider,
    payload: PaymentCallbackPayload,
    db: AsyncSession = Depends(get_db),
) -> PaymentCallbackResult:
    return await payment_service.handle_payment_callback(db, provider, payload)
