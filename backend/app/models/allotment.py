from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, Boolean, Date, ForeignKey, Text
from .base import Base

class Allotment(Base):
    __tablename__ = "allotments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    house_id: Mapped[int] = mapped_column(ForeignKey("houses.id", ondelete="CASCADE"), index=True, nullable=False)

    # core identity
    person_name: Mapped[str] = mapped_column(String(120), nullable=False)
    designation: Mapped[str | None] = mapped_column(String(120), nullable=True)
    bps: Mapped[int | None] = mapped_column(Integer, nullable=True)
    directorate: Mapped[str | None] = mapped_column(String(120), nullable=True)
    cnic: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # dates / lifecycle
    allotment_date: Mapped[Date | None] = mapped_column(Date, nullable=True)
    date_of_birth: Mapped[Date | None] = mapped_column(Date, nullable=True)
    date_of_retirement: Mapped[Date | None] = mapped_column(Date, nullable=True)
    occupation_date: Mapped[Date | None] = mapped_column(Date, nullable=True)  # start of stay
    vacation_date: Mapped[Date | None] = mapped_column(Date, nullable=True)    # end of stay

    # retention
    retention: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    retention_last_date: Mapped[Date | None] = mapped_column(Date, nullable=True)

    # misc
    pool: Mapped[str | None] = mapped_column(String(60), nullable=True)
    qtr_status: Mapped[str | None] = mapped_column(String(60), nullable=True)
    allotment_medium: Mapped[str | None] = mapped_column(String(60), nullable=True)  # family transfer / changes / mutual / other
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    house = relationship("House", back_populates="allotments")
