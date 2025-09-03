from __future__ import annotations

from enum import Enum
from typing import Optional
from datetime import date

from sqlalchemy import String, Integer, Date, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class QtrStatus(str, Enum):
    active = "active"   # occupied
    ended = "ended"     # vacated


class AllotteeStatus(str, Enum):
    in_service = "in_service"
    retired = "retired"
    cancelled = "cancelled"


class Allotment(Base):
    __tablename__ = "allotment"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    house_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("house.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    # Person/meta
    person_name: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)
    designation: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    directorate: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    cnic: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    pool: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    medium: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Dates
    allotment_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    occupation_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    vacation_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    # Status fields
    qtr_status: Mapped[QtrStatus] = mapped_column(
        SAEnum(QtrStatus), nullable=False, default=QtrStatus.active
    )
    allottee_status: Mapped[AllotteeStatus] = mapped_column(
        SAEnum(AllotteeStatus), nullable=False, default=AllotteeStatus.in_service
    )

    # Back relation
    house: Mapped["House"] = relationship(back_populates="allotments")
