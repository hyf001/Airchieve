import asyncio
import json
from dataclasses import dataclass

from app.core.config import settings
from app.core.utils.logger import get_logger

logger = get_logger(__name__)


class SmsSendError(RuntimeError):
    pass


@dataclass(frozen=True)
class SmsSendResult:
    provider: str
    request_id: str | None = None
    code: str | None = None
    message: str | None = None


def _require_aliyun_setting(value: str | None, name: str) -> str:
    if value:
        return value
    raise SmsSendError(f"阿里云短信配置缺失：{name}")


def _send_aliyun_sms_sync(phone: str, code: str) -> SmsSendResult:
    try:
        from alibabacloud_dysmsapi20170525.client import Client as DysmsapiClient
        from alibabacloud_dysmsapi20170525 import models as dysmsapi_models
        from alibabacloud_tea_openapi import models as open_api_models
        from alibabacloud_tea_util import models as util_models
    except ImportError as exc:
        raise SmsSendError("阿里云短信 SDK 未安装，请安装 alibabacloud-dysmsapi20170525") from exc

    access_key_id = _require_aliyun_setting(settings.ALIYUN_SMS_ACCESS_KEY_ID, "ALIYUN_SMS_ACCESS_KEY_ID")
    access_key_secret = _require_aliyun_setting(
        settings.ALIYUN_SMS_ACCESS_KEY_SECRET,
        "ALIYUN_SMS_ACCESS_KEY_SECRET",
    )
    sign_name = _require_aliyun_setting(settings.ALIYUN_SMS_SIGN_NAME, "ALIYUN_SMS_SIGN_NAME")
    template_code = _require_aliyun_setting(settings.ALIYUN_SMS_TEMPLATE_CODE, "ALIYUN_SMS_TEMPLATE_CODE")

    config = open_api_models.Config(
        access_key_id=access_key_id,
        access_key_secret=access_key_secret,
    )
    config.endpoint = settings.ALIYUN_SMS_ENDPOINT
    client = DysmsapiClient(config)
    request = dysmsapi_models.SendSmsRequest(
        phone_numbers=phone,
        sign_name=sign_name,
        template_code=template_code,
        template_param=json.dumps({"code": code}, ensure_ascii=False),
    )
    runtime = util_models.RuntimeOptions()

    try:
        response = client.send_sms_with_options(request, runtime)
    except Exception as exc:
        raise SmsSendError("阿里云短信发送失败") from exc

    body = response.body
    response_code = getattr(body, "code", None)
    request_id = getattr(body, "request_id", None)
    message = getattr(body, "message", None)
    if response_code != "OK":
        raise SmsSendError(message or f"阿里云短信发送失败：{response_code}")

    return SmsSendResult(provider="aliyun", request_id=request_id, code=response_code, message=message)


async def send_verification_code(phone: str, code: str) -> SmsSendResult:
    if settings.DEBUG:
        logger.info("DEBUG=true, skip aliyun sms send for phone=%s", phone)
        return SmsSendResult(provider="debug", code="OK", message="debug sms skipped")

    return await asyncio.to_thread(_send_aliyun_sms_sync, phone, code)
