from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, Boolean, Date, ForeignKey, Text
from .base import Base

class Allotment(Base):
    __tablename__ = "allotments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    house_id: Mapped[int] = mapped_column(ForeignKey("houses.id", ondelete="CASCADE"), index=True, nullable=False)

    person_name: Mapped[str] = mapped_column(String(120), nullable=False)
    cnic: Mapped[str | None] = mapped_column(String(20), nullable=True)
    start_date: Mapped[Date] = mapped_column(Date, nullable=False)
    end_date: Mapped[Date | None] = mapped_column(Date, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    house = relationship("House", back_populates="allotments")
