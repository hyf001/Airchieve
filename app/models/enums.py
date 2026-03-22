"""
枚举定义
"""
from enum import Enum


# ---------------------------------------------------------------------------
# CLI 相关
# ---------------------------------------------------------------------------

class CliType(str, Enum):
    """CLI类型"""
    GEMINI = "gemini"
    CLAUDE = "claude"
    OPENAI = "openai"


# ---------------------------------------------------------------------------
# 图片相关
# ---------------------------------------------------------------------------

class AspectRatio(str, Enum):
    """图片比例"""
    RATIO_1_1 = "1:1"
    RATIO_16_9 = "16:9"
    RATIO_4_3 = "4:3"


class ImageSize(str, Enum):
    """图片尺寸"""
    SIZE_1K = "1k"
    SIZE_2K = "2k"
    SIZE_4K = "4k"


# ---------------------------------------------------------------------------
# 绘本相关
# ---------------------------------------------------------------------------

class PageType(str, Enum):
    """页面类型"""
    COVER = "cover"       # 封面
    BACK_COVER = "back_cover"  # 封底
    CONTENT = "content"   # 内页（默认）


# ---------------------------------------------------------------------------
# 用户相关
# ---------------------------------------------------------------------------

class UserRole(str, Enum):
    """用户角色"""
    admin = "admin"
    user  = "user"


class UserStatus(str, Enum):
    """账号状态"""
    active  = "active"
    banned  = "banned"
    deleted = "deleted"


class AuthType(str, Enum):
    """登录凭证类型"""
    password   = "password"    # 账号 + 密码
    sms        = "sms"         # 手机号（验证码在缓存层校验，不持久化）
    wechat_web  = "wechat_web"   # 微信网页扫码授权（openid）
    wechat_mini = "wechat_mini"  # 微信小程序（code 换 openid）


class MembershipLevel(str, Enum):
    """会员等级（订阅制：lite / pro / max，按月）"""
    free = "free"
    lite = "lite"
    pro  = "pro"
    max  = "max"


# ---------------------------------------------------------------------------
# 积分相关
# ---------------------------------------------------------------------------

class PointsLogType(str, Enum):
    """积分流水类型"""
    recharge      = "recharge"       # 微信支付充值
    creation_cost = "creation_cost"  # 绘本创作消耗
    bonus         = "bonus"          # 平台奖励（注册礼包等）
    refund        = "refund"         # 退款返还
    admin_adjust  = "admin_adjust"   # 管理员手动调整


# ---------------------------------------------------------------------------
# 支付相关
# ---------------------------------------------------------------------------

class OrderStatus(str, Enum):
    """充值订单状态"""
    pending  = "pending"   # 待支付
    paid     = "paid"      # 已支付
    failed   = "failed"    # 支付失败
    refunded = "refunded"  # 已退款


class SubscriptionStatus(str, Enum):
    """订阅订单状态"""
    pending   = "pending"    # 待支付
    active    = "active"     # 生效中
    expired   = "expired"    # 已到期
    cancelled = "cancelled"  # 已取消
