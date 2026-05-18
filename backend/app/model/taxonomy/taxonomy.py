from enum import StrEnum

from sqlalchemy import Enum, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.model.base import Base, TimestampMixin


class TaxonomyType(StrEnum):
    AGE_RANGE = "age_range"
    THEME = "theme"
    INTEREST_TAG = "interest_tag"
    EDUCATION_GOAL = "education_goal"
    READING_LEVEL = "reading_level"
    LANGUAGE = "language"
    NARRATIVE_STYLE = "narrative_style"
    SCENE = "scene"
    VOICE_STYLE = "voice_style"
    ASSET_CATEGORY = "asset_category"


class TaxonomyItemStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"


def _enum_values(enum_cls: type[StrEnum]) -> list[str]:
    return [item.value for item in enum_cls]


class TaxonomyItem(TimestampMixin, Base):
    __tablename__ = "taxonomy_items"
    __table_args__ = (UniqueConstraint("type", "code", name="uq_taxonomy_type_code"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    type: Mapped[TaxonomyType] = mapped_column(
        Enum(TaxonomyType, values_callable=_enum_values),
        nullable=False,
        index=True,
    )
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    name_en: Mapped[str | None] = mapped_column(String(120), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[TaxonomyItemStatus] = mapped_column(
        Enum(TaxonomyItemStatus, values_callable=_enum_values),
        nullable=False,
        default=TaxonomyItemStatus.ACTIVE,
    )
