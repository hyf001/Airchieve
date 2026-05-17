from sqlalchemy import Boolean, Enum, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.model.account.enums import ChildProfileStatus, ChildProfileVisibility
from app.model.account.user import User
from app.model.account.utils import uuid_str
from app.model.base import Base, TimestampMixin


class ChildProfile(TimestampMixin, Base):
    __tablename__ = "child_profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    nickname: Mapped[str] = mapped_column(String(80), nullable=False)
    age_range_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    reading_level_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    interest_tag_ids: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    education_goal_ids: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    default_character_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    default_voice_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    default_art_style_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    visibility: Mapped[ChildProfileVisibility] = mapped_column(
        Enum(ChildProfileVisibility),
        default=ChildProfileVisibility.PRIVATE,
        nullable=False,
    )
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[ChildProfileStatus] = mapped_column(
        Enum(ChildProfileStatus),
        default=ChildProfileStatus.ACTIVE,
        nullable=False,
    )

    user: Mapped[User] = relationship(back_populates="child_profiles")
