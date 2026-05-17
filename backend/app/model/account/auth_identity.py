from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.model.account.enums import AuthIdentityStatus, AuthProvider
from app.model.account.user import User
from app.model.base import Base, TimestampMixin


class AccountAuthIdentity(TimestampMixin, Base):
    __tablename__ = "account_auth_identities"
    __table_args__ = (
        UniqueConstraint("provider", "provider_app_id", "provider_user_id", name="uq_auth_identity_provider_user"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    provider: Mapped[AuthProvider] = mapped_column(Enum(AuthProvider), nullable=False)
    provider_app_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    provider_user_id: Mapped[str] = mapped_column(String(255), nullable=False)
    union_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    display_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    bound_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[AuthIdentityStatus] = mapped_column(
        Enum(AuthIdentityStatus),
        default=AuthIdentityStatus.ACTIVE,
        nullable=False,
    )

    user: Mapped[User] = relationship(back_populates="identities")
