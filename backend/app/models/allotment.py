from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, Boolean, Date, ForeignKey, Text
from enum import Enum
from sqlmodel import SQLModel, Field, Relationship
from datetime import date
from .base import Base

class Allotment(Base):
    __tablename__ = "allotments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    house_id: Mapped[int] = mapped_column(ForeignKey("houses.id", ondelete="CASCADE"), index=True, nullable=False)

    person_name: Mapped[str] = mapped_column(String(120), nullable=False)
    designation: Mapped[str | None] = mapped_column(String(120), nullable=True)
    bps: Mapped[int | None] = mapped_column(Integer, nullable=True)
    directorate: Mapped[str | None] = mapped_column(String(120), nullable=True)
    cnic: Mapped[str | None] = mapped_column(String(20), nullable=True)

    allotment_date: Mapped[Date | None] = mapped_column(Date, nullable=True)
    date_of_birth: Mapped[Date | None] = mapped_column(Date, nullable=True)
    date_of_retirement: Mapped[Date | None] = mapped_column(Date, nullable=True)
    occupation_date: Mapped[Date | None] = mapped_column(Date, nullable=True)
    vacation_date: Mapped[Date | None] = mapped_column(Date, nullable=True)

    retention: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    retention_last_date: Mapped[Date | None] = mapped_column(Date, nullable=True)

    pool: Mapped[str | None] = mapped_column(String(60), nullable=True)
    qtr_status: Mapped[str | None] = mapped_column(String(60), nullable=True)
    allotment_medium: Mapped[str | None] = mapped_column(String(60), nullable=True)

    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    house = relationship("House", back_populates="allotments")
class AllotteeStatus(str, Enum):
    in_service = "in_service"
    retired = "retired"
    cancelled = "cancelled"

class QtrStatus(str, Enum):
    active = "active"   # occupied
    ended = "ended"     # vacated

class Allotment(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    house_id: int = Field(foreign_key="house.id")
    # person fields…
    occupation_date: date | None = None
    vacation_date: date | None = None

    qtr_status: QtrStatus = Field(default=QtrStatus.active)
    allottee_status: AllotteeStatus = Field(default=AllotteeStatus.in_service)

    house: "House" = Relationship(back_populates="allotments")

    @property
    def is_active(self) -> bool:
        return self.qtr_status == QtrStatus.active