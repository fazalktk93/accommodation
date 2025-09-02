from __future__ import annotations
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, Date, DateTime, Text, ForeignKey, func
from .base import Base

class FileMovement(Base):
    __tablename__ = "file_movements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    house_id: Mapped[int] = mapped_column(
        ForeignKey("houses.id", ondelete="CASCADE"), index=True, nullable=False
    )
    file_no: Mapped[str] = mapped_column(String(64), index=True, nullable=False)

    subject: Mapped[str] = mapped_column(String(200), nullable=False)
    issued_to: Mapped[str] = mapped_column(String(120), nullable=False)
    department: Mapped[str] = mapped_column(String(120), nullable=True)
    due_date: Mapped[Date | None] = mapped_column(Date, nullable=True)

    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    issue_date: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    return_date: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    house: Mapped["House"] = relationship(back_populates="movements")
