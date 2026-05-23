from sqlalchemy import Boolean, Enum, Index, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.model.asset.enums import AssetAccessLevel, AssetSourceType, LibraryItemStatus
from app.model.base import Base, TimestampMixin


class Character(TimestampMixin, Base):
    __tablename__ = "characters"
    __table_args__ = (
        Index(
            "uq_characters_one_default_per_user",
            "owner_user_id",
            unique=True,
            postgresql_where=text("is_default = true AND owner_user_id IS NOT NULL"),
            sqlite_where=text("is_default = 1 AND owner_user_id IS NOT NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    reference_character_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    art_style_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    generation_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    category_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    access_level: Mapped[AssetAccessLevel] = mapped_column(Enum(AssetAccessLevel), nullable=False, default=AssetAccessLevel.FREE, index=True)
    source_type: Mapped[AssetSourceType] = mapped_column(Enum(AssetSourceType), nullable=False, default=AssetSourceType.AI_GENERATED, index=True)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[LibraryItemStatus] = mapped_column(Enum(LibraryItemStatus), nullable=False, default=LibraryItemStatus.ACTIVE, index=True)
