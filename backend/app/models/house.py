from __future__ import annotations

from typing import Optional

from sqlalchemy import String, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class HouseStatus:
    VACANT = "vacant"
    OCCUPIED = "occupied"
    MAINTENANCE = "maintenance"


class House(Base):
    __tablename__ = "house"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # Canonical identifiers
    file_no: Mapped[str] = mapped_column(String, index=True, unique=True)
    qtr_no: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)
    street: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)
    sector: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)
    type_code: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)

    # Header status
    status: Mapped[str] = mapped_column(String, nullable=False, default=HouseStatus.VACANT)
    status_manual: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Relationship to allotments (typed SA 2.0)
    allotments: Mapped[list["Allotment"]] = relationship(
        back_populates="house",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
