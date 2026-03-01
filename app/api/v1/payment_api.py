"""
Payment API
支付接口（积分充值 & 会员订阅）

端点：
  POST /payment/recharge                创建积分充值订单
  POST /payment/subscription            创建会员订阅订单
  GET  /payment/recharge/{order_no}     查询充值订单状态（前端轮询）
  GET  /payment/subscription/{order_no} 查询订阅订单状态（前端轮询）
  POST /payment/notify/recharge         微信充值支付回调（无鉴权）
  POST /payment/notify/subscription     微信订阅支付回调（无鉴权）

支付渠道：
  h5     → 手机浏览器，返回 h5_url，前端做页面跳转
  native → PC 扫码，返回 code_url，前端渲染二维码
"""
import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.core.config import settings
from app.models.user import MembershipLevel, User
from app.services import payment_service
from app.services.wechat_pay import (
    create_h5_order,
    create_native_order,
    decrypt_notify_resource,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payment", tags=["payment"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class CreateRechargeRequest(BaseModel):
    amount_fen:  int                      = Field(..., gt=0, description="支付金额（分）如 1000 = 10元")
    pay_channel: Literal["h5", "native"]  = Field("native", description="h5=手机 native=PC扫码")
    client_ip:   str                      = Field("127.0.0.1", description="H5 支付时需传客户端真实 IP")


class CreateSubscriptionRequest(BaseModel):
    level:       Literal["lite", "pro", "max"] = Field(..., description="会员等级")
    months:      int                            = Field(1, ge=1, le=12, description="购买月数")
    amount_fen:  int                            = Field(..., gt=0, description="支付金额（分）")
    pay_channel: Literal["h5", "native"]        = Field("native")
    client_ip:   str                            = Field("127.0.0.1")


class PayOrderOut(BaseModel):
    order_no:  str
    pay_type:  str            # "h5" | "native"
    h5_url:    str | None = None   # H5 跳转链接
    code_url:  str | None = None   # Native 二维码内容


class OrderStatusOut(BaseModel):
    order_no: str
    status:   str   # pending / paid / failed / refunded / active / expired / cancelled


# ---------------------------------------------------------------------------
# 充值订单
# ---------------------------------------------------------------------------

@router.post("/recharge", response_model=PayOrderOut)
async def create_recharge(
    req: CreateRechargeRequest,
    current_user: User = Depends(get_current_user),
):
    """创建积分充值订单，返回微信支付参数"""
    order = await payment_service.create_recharge_order(current_user.id, req.amount_fen)

    notify_url  = f"{settings.WECHAT_PAY_NOTIFY_URL}/recharge"
    description = f"积分充值 {order.points_amount} 积分"

    try:
        if req.pay_channel == "h5":
            h5_url = await create_h5_order(
                order_no=order.order_no,
                amount_fen=req.amount_fen,
                description=description,
                notify_url=notify_url,
                client_ip=req.client_ip,
            )
            return PayOrderOut(order_no=order.order_no, pay_type="h5", h5_url=h5_url)
        else:
            code_url = await create_native_order(
                order_no=order.order_no,
                amount_fen=req.amount_fen,
                description=description,
                notify_url=notify_url,
            )
            return PayOrderOut(order_no=order.order_no, pay_type="native", code_url=code_url)

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))


# ---------------------------------------------------------------------------
# 订阅订单
# ---------------------------------------------------------------------------

@router.post("/subscription", response_model=PayOrderOut)
async def create_subscription(
    req: CreateSubscriptionRequest,
    current_user: User = Depends(get_current_user),
):
    """创建会员订阅订单，返回微信支付参数"""
    level = MembershipLevel(req.level)
    order = await payment_service.create_subscription_order(
        user_id=current_user.id,
        level=level,
        months=req.months,
        amount_fen=req.amount_fen,
    )

    notify_url  = f"{settings.WECHAT_PAY_NOTIFY_URL}/subscription"
    description = f"{req.level.capitalize()} 会员 {req.months} 个月"

    try:
        if req.pay_channel == "h5":
            h5_url = await create_h5_order(
                order_no=order.order_no,
                amount_fen=req.amount_fen,
                description=description,
                notify_url=notify_url,
                client_ip=req.client_ip,
            )
            return PayOrderOut(order_no=order.order_no, pay_type="h5", h5_url=h5_url)
        else:
            code_url = await create_native_order(
                order_no=order.order_no,
                amount_fen=req.amount_fen,
                description=description,
                notify_url=notify_url,
            )
            return PayOrderOut(order_no=order.order_no, pay_type="native", code_url=code_url)

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))


# ---------------------------------------------------------------------------
# 查询订单状态（前端轮询）
# ---------------------------------------------------------------------------

@router.get("/recharge/{order_no}", response_model=OrderStatusOut)
async def get_recharge_status(
    order_no: str,
    current_user: User = Depends(get_current_user),
):
    """查询充值订单当前状态"""
    order = await payment_service.get_recharge_order(order_no)
    if order is None or order.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="订单不存在")
    return OrderStatusOut(order_no=order.order_no, status=order.status)


@router.get("/subscription/{order_no}", response_model=OrderStatusOut)
async def get_subscription_status(
    order_no: str,
    current_user: User = Depends(get_current_user),
):
    """查询订阅订单当前状态"""
    order = await payment_service.get_subscription_order(order_no)
    if order is None or order.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="订单不存在")
    return OrderStatusOut(order_no=order.order_no, status=order.status)


# ---------------------------------------------------------------------------
# 微信回调（无需用户鉴权，微信服务器主动推送）
# ---------------------------------------------------------------------------

@router.post("/notify/recharge", include_in_schema=False)
async def notify_recharge(request: Request):
    """
    微信充值支付成功回调。

    微信要求：
      - 成功处理返回 {"code": "SUCCESS"}
      - 失败返回 {"code": "FAIL"} 触发微信重试（最多 8 次）
    """
    try:
        body     = await request.json()
        resource = body.get("resource", {})
        data     = decrypt_notify_resource(resource)

        order_no    = data["out_trade_no"]
        tx_id       = data["transaction_id"]
        trade_state = data.get("trade_state", "")

        if trade_state == "SUCCESS":
            await payment_service.handle_recharge_paid(order_no, tx_id)
            logger.info("充值回调处理成功: order=%s tx=%s", order_no, tx_id)

    except Exception as e:
        logger.error("充值回调处理失败: %s", e, exc_info=True)
        return {"code": "FAIL", "message": str(e)}

    return {"code": "SUCCESS", "message": "OK"}


@router.post("/notify/subscription", include_in_schema=False)
async def notify_subscription(request: Request):
    """微信订阅支付成功回调"""
    try:
        body     = await request.json()
        resource = body.get("resource", {})
        data     = decrypt_notify_resource(resource)

        order_no    = data["out_trade_no"]
        tx_id       = data["transaction_id"]
        trade_state = data.get("trade_state", "")

        if trade_state == "SUCCESS":
            await payment_service.handle_subscription_paid(order_no, tx_id)
            logger.info("订阅回调处理成功: order=%s tx=%s", order_no, tx_id)

    except Exception as e:
        logger.error("订阅回调处理失败: %s", e, exc_info=True)
        return {"code": "FAIL", "message": str(e)}

    return {"code": "SUCCESS", "message": "OK"}
