from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.model.payment import PaymentEventType, PaymentOrderStatus, PaymentProvider, RefundStatus


class CreateMembershipOrderRequest(BaseModel):
    plan_id: int
    provider: PaymentProvider
    return_url: str | None = Field(default=None, max_length=512)
    idempotency_key: str | None = Field(default=None, max_length=120)


class PaymentParams(BaseModel):
    provider: PaymentProvider
    order_no: str
    amount_cents: int
    currency: str
    nonce: str


class PaymentOrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_no: str
    user_id: int
    plan_id: int
    amount_cents: int
    currency: str
    provider: PaymentProvider
    status: PaymentOrderStatus
    provider_order_id: str | None = None
    payment_params: PaymentParams | None = None
    paid_at: datetime | None = None
    expired_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class PaymentRecordRead(BaseModel):
    id: int
    order_id: int
    order_no: str
    provider: PaymentProvider
    event_type: PaymentEventType
    amount_cents: int
    occurred_at: datetime


class PaymentCallbackPayload(BaseModel):
    order_no: str
    event_type: PaymentEventType
    amount_cents: int = Field(ge=0)
    provider_order_id: str | None = Field(default=None, max_length=120)
    occurred_at: datetime | None = None
    current_period_start: datetime | None = None
    current_period_end: datetime | None = None
    auto_renew: bool = False
    message: str | None = Field(default=None, max_length=500)


class PaymentCallbackResult(BaseModel):
    handled: bool
    order_id: int | None = None
    status: PaymentOrderStatus
    message: str | None = None


class RefundCreate(BaseModel):
    amount_cents: int = Field(gt=0)
    reason: str | None = Field(default=None, max_length=500)


class RefundRecordRead(BaseModel):
    id: int
    order_id: int
    refund_no: str
    amount_cents: int
    reason: str | None = None
    status: RefundStatus
    provider_refund_id: str | None = None
    created_at: datetime
    updated_at: datetime
