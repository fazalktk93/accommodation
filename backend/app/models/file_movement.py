from __future__ import annotations

from typing import Optional
from datetime import date

from sqlalchemy import String, Integer, Date
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class FileMovement(Base):
    __tablename__ = "file_movement"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    file_no: Mapped[str] = mapped_column(String, index=True)
    subject: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    issued_to: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    department: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    issue_date: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    returned_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    remarks: Mapped[Optional[str]] = mapped_column(String, nullable=True)
