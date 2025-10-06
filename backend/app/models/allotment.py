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
    retention  = "retention"
    cancelled = "cancelled"
    unauthorized = "unauthorized"


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
    bps: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Dates
    allotment_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    occupation_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    vacation_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    dob: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    dor: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    retention_until: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    retention_last: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    # Status
    qtr_status: Mapped[QtrStatus] = mapped_column(
        SAEnum(QtrStatus), nullable=False, default=QtrStatus.active
    )
    allottee_status: Mapped[AllotteeStatus] = mapped_column(
        SAEnum(AllotteeStatus), nullable=False, default=AllotteeStatus.in_service
    )
    notes: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Back relation
    house: Mapped["House"] = relationship(back_populates="allotments")
