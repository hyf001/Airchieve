from datetime import datetime

from sqlalchemy import DateTime, Enum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.model.account.enums import SmsCodeStatus, SmsScene
from app.model.base import Base, TimestampMixin


class SmsVerificationCode(TimestampMixin, Base):
    __tablename__ = "sms_verification_codes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    phone: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    scene: Mapped[SmsScene] = mapped_column(Enum(SmsScene), nullable=False)
    code_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    send_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    device_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    captcha_ticket: Mapped[str | None] = mapped_column(String(255), nullable=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[SmsCodeStatus] = mapped_column(Enum(SmsCodeStatus), default=SmsCodeStatus.PENDING, nullable=False)
