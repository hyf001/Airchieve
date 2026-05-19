from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.model.base import Base, TimestampMixin


class ShareAccessScope(StrEnum):
    PUBLIC = "public"
    PASSWORD = "password"
    SPECIFIED = "specified"


class ShareLinkStatus(StrEnum):
    ACTIVE = "active"
    CLOSED = "closed"
    BANNED = "banned"
    EXPIRED = "expired"


class ShareLink(TimestampMixin, Base):
    __tablename__ = "share_links"
    __table_args__ = (UniqueConstraint("user_id", "idempotency_key", name="uq_share_links_user_idempotency"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    book_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    title_snapshot: Mapped[str] = mapped_column(String(160), nullable=False)
    cover_asset_id_snapshot: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cover_url_snapshot: Mapped[str | None] = mapped_column(String(500), nullable=True)
    access_scope: Mapped[ShareAccessScope] = mapped_column(
        Enum(ShareAccessScope),
        nullable=False,
        default=ShareAccessScope.PUBLIC,
        index=True,
    )
    password_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    status: Mapped[ShareLinkStatus] = mapped_column(
        Enum(ShareLinkStatus),
        nullable=False,
        default=ShareLinkStatus.ACTIVE,
        index=True,
    )
    privacy_confirmation_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)

    access_logs: Mapped[list["ShareAccessLog"]] = relationship(back_populates="share")


class ShareAccessLog(Base):
    __tablename__ = "share_access_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    share_id: Mapped[int] = mapped_column(ForeignKey("share_links.id"), nullable=False, index=True)
    visitor_id: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    ip_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(300), nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)

    share: Mapped[ShareLink] = relationship(back_populates="access_logs")
