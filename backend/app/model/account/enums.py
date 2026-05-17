from enum import StrEnum


class UserRole(StrEnum):
    PARENT = "parent"
    TEACHER = "teacher"
    ADMIN = "admin"


class UserStatus(StrEnum):
    ACTIVE = "active"
    DISABLED = "disabled"


class AuthProvider(StrEnum):
    WECHAT = "wechat"
    PHONE = "phone"
    EMAIL = "email"


class AuthIdentityStatus(StrEnum):
    ACTIVE = "active"
    UNBOUND = "unbound"


class SmsScene(StrEnum):
    REGISTER = "register"
    PHONE_LOGIN = "phone_login"
    BIND_PHONE = "bind_phone"
    CHANGE_PHONE = "change_phone"
    UNBIND_PHONE = "unbind_phone"


class SmsCodeStatus(StrEnum):
    PENDING = "pending"
    VERIFIED = "verified"
    EXPIRED = "expired"
    BLOCKED = "blocked"


class RiskAction(StrEnum):
    SEND_SMS = "send_sms"
    PHONE_LOGIN = "phone_login"
    WECHAT_LOGIN = "wechat_login"
    BIND_PHONE = "bind_phone"
    BIND_WECHAT = "bind_wechat"
    UPLOAD_CHARACTER = "upload_character"
    CREATE_VOICE = "create_voice"
    EXPORT_PDF = "export_pdf"
    SHARE_PERSONAL_ASSET = "share_personal_asset"


class CaptchaProvider(StrEnum):
    SLIDER = "slider"
    IMAGE = "image"
    SILENT = "silent"
    THIRD_PARTY = "third_party"


class RiskChallengeStatus(StrEnum):
    PENDING = "pending"
    PASSED = "passed"
    FAILED = "failed"
    EXPIRED = "expired"


class LoginMethod(StrEnum):
    PHONE_CODE = "phone_code"
    PASSWORD = "password"
    WECHAT = "wechat"
    REGISTER = "register"


class ChildProfileVisibility(StrEnum):
    PRIVATE = "private"


class ChildProfileStatus(StrEnum):
    ACTIVE = "active"
    DELETED = "deleted"
