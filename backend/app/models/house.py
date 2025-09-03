from __future__ import annotations

from typing import Optional

from sqlalchemy import String, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class House(Base):
    __tablename__ = "house"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # Canonical identifiers used throughout the app
    file_no: Mapped[str] = mapped_column(String, index=True, unique=True)
    qtr_no: Mapped[Optional[int]] = mapped_column(Integer, index=True, nullable=True)
    street: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)
    sector: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)
    type_code: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)

    # Header status
    status: Mapped[str] = mapped_column(String, nullable=False, default="vacant")
    status_manual: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Relationship to allotments
    allotments: Mapped[list["Allotment"]] = relationship(
        back_populates="house",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
