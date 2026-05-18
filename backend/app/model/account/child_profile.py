from sqlalchemy import Boolean, Enum, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.model.account.enums import (
    ChildProfileAgeRange,
    ChildProfileEducationGoal,
    ChildProfileInterestTag,
    ChildProfileReadingLevel,
    ChildProfileStatus,
    ChildProfileVisibility,
)
from app.model.account.user import User
from app.model.base import Base, TimestampMixin


class ChildProfile(TimestampMixin, Base):
    __tablename__ = "child_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    nickname: Mapped[str] = mapped_column(String(80), nullable=False)
    age_range: Mapped[ChildProfileAgeRange | None] = mapped_column(String(64), nullable=True)
    reading_level: Mapped[ChildProfileReadingLevel | None] = mapped_column(String(64), nullable=True)
    interest_tags: Mapped[list[ChildProfileInterestTag]] = mapped_column(JSON, default=list, nullable=False)
    education_goals: Mapped[list[ChildProfileEducationGoal]] = mapped_column(JSON, default=list, nullable=False)
    default_character: Mapped[str | None] = mapped_column(String(64), nullable=True)
    default_voice: Mapped[str | None] = mapped_column(String(64), nullable=True)
    default_art_style: Mapped[str | None] = mapped_column(String(64), nullable=True)
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
