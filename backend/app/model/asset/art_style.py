from sqlalchemy import Enum, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.model.asset.enums import ArtStyleStatus, AssetAccessLevel
from app.model.base import Base, TimestampMixin


class ArtStyle(TimestampMixin, Base):
    __tablename__ = "art_styles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    code: Mapped[str | None] = mapped_column(String(80), nullable=True, unique=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    example_asset_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    example_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    age_range_codes: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    access_level: Mapped[AssetAccessLevel] = mapped_column(Enum(AssetAccessLevel), nullable=False, default=AssetAccessLevel.FREE, index=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[ArtStyleStatus] = mapped_column(Enum(ArtStyleStatus), nullable=False, default=ArtStyleStatus.ACTIVE, index=True)
