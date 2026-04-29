from datetime import datetime, timezone
from typing import Literal

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, JsonText


GenerationDebugStatus = Literal["pending", "running", "finished", "error"]


class StorybookReferenceImage(Base):
    __tablename__ = "storybook_reference_images"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    storybook_id: Mapped[int] = mapped_column(
        ForeignKey("storybooks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    image_url: Mapped[str] = mapped_column(Text, nullable=False)
    reference_type: Mapped[str] = mapped_column(String(64), default="character", nullable=False, index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )


class GenerationDebugRun(Base):
    __tablename__ = "generation_debug_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    storybook_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    page_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    admin_user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    status: Mapped[GenerationDebugStatus] = mapped_column(String(32), default="pending", nullable=False, index=True)
    debug_params: Mapped[dict] = mapped_column(JsonText, nullable=False)
    output_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tags: Mapped[list[str]] = mapped_column(JsonText, default=list, nullable=False)
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
