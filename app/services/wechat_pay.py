"""
WeChat Pay Service (APIv3)
微信支付服务 — APIv3

支持：
  H5 支付    → create_h5_order()      手机浏览器，跳转微信 App 完成支付
  Native 支付 → create_native_order()  PC扫码，前端渲染二维码

签名算法：RSA-SHA256，无需第三方 SDK（依赖标准库 cryptography）
回调解密：AES-256-GCM

依赖（pip install）：
  httpx
  cryptography
"""
import base64
import json
import time
import uuid

import httpx
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings

WECHAT_PAY_BASE = "https://api.mch.weixin.qq.com"


# ---------------------------------------------------------------------------
# 签名 & 请求头
# ---------------------------------------------------------------------------

def _load_private_key():
    """从配置加载私钥对象（PEM 格式，.env 中换行用 \\n 存储）"""
    pem = settings.WECHAT_PAY_PRIVATE_KEY.replace("\\n", "\n").encode()
    return serialization.load_pem_private_key(pem, password=None)


def _build_auth_header(method: str, url_path: str, body: str = "") -> str:
    """
    构造 WECHATPAY2-SHA256-RSA2048 Authorization Header。

    签名消息格式（每项末尾含 \\n）：
        HTTP方法\\n
        URL路径（含 ?query）\\n
        时间戳\\n
        随机串\\n
        请求体\\n
    """
    ts    = str(int(time.time()))
    nonce = uuid.uuid4().hex
    message = f"{method}\n{url_path}\n{ts}\n{nonce}\n{body}\n"

    private_key = _load_private_key()
    sig_bytes   = private_key.sign(message.encode(), padding.PKCS1v15(), hashes.SHA256())
    signature   = base64.b64encode(sig_bytes).decode()

    return (
        f'WECHATPAY2-SHA256-RSA2048 '
        f'mchid="{settings.WECHAT_PAY_MCHID}",'
        f'nonce_str="{nonce}",'
        f'signature="{signature}",'
        f'timestamp="{ts}",'
        f'serial_no="{settings.WECHAT_PAY_CERT_SERIAL_NO}"'
    )


async def _post(path: str, payload: dict) -> dict:
    """发送签名 POST 请求到微信支付 API"""
    body    = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    auth    = _build_auth_header("POST", path, body)
    headers = {
        "Authorization": auth,
        "Content-Type":  "application/json",
        "Accept":        "application/json",
        "User-Agent":    "AIrchieve/1.0",
    }
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(f"{WECHAT_PAY_BASE}{path}", content=body.encode(), headers=headers)

    data = resp.json()
    if resp.status_code not in (200, 201, 204):
        code    = data.get("code", resp.status_code)
        message = data.get("message", "未知错误")
        raise ValueError(f"微信支付请求失败 [{code}] {message}")
    return data


# ---------------------------------------------------------------------------
# 下单接口
# ---------------------------------------------------------------------------

async def create_h5_order(
    order_no:    str,
    amount_fen:  int,
    description: str,
    notify_url:  str,
    client_ip:   str = "127.0.0.1",
) -> str:
    """
    H5 下单（手机浏览器）

    Returns:
        h5_url: 前端直接 window.location.href 跳转
    """
    payload = {
        "appid":        settings.WECHAT_PAY_APP_ID,
        "mchid":        settings.WECHAT_PAY_MCHID,
        "description":  description,
        "out_trade_no": order_no,
        "notify_url":   notify_url,
        "amount":       {"total": amount_fen, "currency": "CNY"},
        "scene_info":   {
            "payer_client_ip": client_ip,
            "h5_info":         {"type": "Wap"},
        },
    }
    data = await _post("/v3/pay/transactions/h5", payload)
    return data["h5_url"]


async def create_native_order(
    order_no:    str,
    amount_fen:  int,
    description: str,
    notify_url:  str,
) -> str:
    """
    Native 下单（PC 扫码）

    Returns:
        code_url: weixin://wxpay/... 格式，前端用 QR 库渲染成二维码
    """
    payload = {
        "appid":        settings.WECHAT_PAY_APP_ID,
        "mchid":        settings.WECHAT_PAY_MCHID,
        "description":  description,
        "out_trade_no": order_no,
        "notify_url":   notify_url,
        "amount":       {"total": amount_fen, "currency": "CNY"},
    }
    data = await _post("/v3/pay/transactions/native", payload)
    return data["code_url"]


# ---------------------------------------------------------------------------
# 回调：验签 & 解密
# ---------------------------------------------------------------------------

def decrypt_notify_resource(resource: dict) -> dict:
    """
    解密微信支付回调中的 resource 字段（AEAD_AES_256_GCM）。

    resource 结构：
        {
            "algorithm":       "AEAD_AES_256_GCM",
            "ciphertext":      "<base64>",
            "associated_data": "<str>",   # 可能为空
            "nonce":           "<str>",
        }

    Returns:
        解密后的业务数据（dict），包含 out_trade_no / transaction_id / trade_state 等字段
    """
    key        = settings.WECHAT_PAY_API_KEY_V3.encode()   # 32 字节
    nonce      = resource["nonce"].encode()
    ad         = (resource.get("associated_data") or "").encode()
    ciphertext = base64.b64decode(resource["ciphertext"])

    aesgcm    = AESGCM(key)
    plaintext = aesgcm.decrypt(nonce, ciphertext, ad)
    return json.loads(plaintext)
