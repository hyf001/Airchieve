from sqlalchemy import Enum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.model.asset.enums import AssetKind, AssetStatus, AssetVisibility
from app.model.base import Base, TimestampMixin


class Asset(TimestampMixin, Base):
    __tablename__ = "assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    asset_kind: Mapped[AssetKind] = mapped_column(Enum(AssetKind), nullable=False, index=True)
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False, unique=True)
    mime_type: Mapped[str] = mapped_column(String(120), nullable=False)
    byte_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    checksum: Mapped[str | None] = mapped_column(String(128), nullable=True)
    visibility: Mapped[AssetVisibility] = mapped_column(Enum(AssetVisibility), nullable=False, default=AssetVisibility.PRIVATE, index=True)
    status: Mapped[AssetStatus] = mapped_column(Enum(AssetStatus), nullable=False, default=AssetStatus.UPLOADING, index=True)
