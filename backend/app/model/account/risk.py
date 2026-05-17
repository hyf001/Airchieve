from datetime import datetime

from sqlalchemy import DateTime, Enum, String
from sqlalchemy.orm import Mapped, mapped_column

from app.model.account.enums import CaptchaProvider, RiskAction, RiskChallengeStatus
from app.model.account.utils import uuid_str
from app.model.base import Base, TimestampMixin


class AccountRiskChallenge(TimestampMixin, Base):
    __tablename__ = "account_risk_challenges"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    action: Mapped[RiskAction] = mapped_column(Enum(RiskAction), nullable=False)
    provider: Mapped[CaptchaProvider] = mapped_column(Enum(CaptchaProvider), nullable=False)
    ticket_hash: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    device_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[RiskChallengeStatus] = mapped_column(
        Enum(RiskChallengeStatus),
        default=RiskChallengeStatus.PENDING,
        nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
