from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.model.base import Base, TimestampMixin


class Item(TimestampMixin, Base):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String(1024), nullable=True)

