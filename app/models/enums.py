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
    # CLAUDE = "claude"
    # OPENAI = "openai"
    DOUBAO = "doubao"


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


class StoryType(str, Enum):
    """故事类型"""
    FAIRY_TALE = "fairy_tale"       # 童话
    ADVENTURE = "adventure"         # 冒险
    EDUCATION = "education"         # 教育
    SCIFI = "scifi"                 # 科幻
    FANTASY = "fantasy"             # 奇幻
    ANIMAL = "animal"               # 动物
    DAILY_LIFE = "daily_life"       # 日常生活
    BEDTIME_STORY = "bedtime_story" # 睡前故事


class Language(str, Enum):
    """语言"""
    ZH = "zh"     # 中文
    EN = "en"     # 英文
    JA = "ja"     # 日语
    KO = "ko"     # 韩语


class AgeGroup(str, Enum):
    """年龄组"""
    AGE_0_3 = "0_3"       # 0-3岁
    AGE_3_6 = "3_6"       # 3-6岁
    AGE_6_8 = "6_8"       # 6-8岁
    AGE_8_12 = "8_12"     # 8-12岁
    AGE_12_PLUS = "12_plus"  # 12岁以上


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
