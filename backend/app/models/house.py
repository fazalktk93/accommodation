from __future__ import annotations
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Integer
from .base import Base

class House(Base):
    __tablename__ = "houses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    file_no: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    qtr_no: Mapped[int] = mapped_column(Integer, nullable=False)
    sector: Mapped[str] = mapped_column(String(64), nullable=False)

    # relationships
    allotments: Mapped[list["Allotment"]] = relationship(
        back_populates="house", cascade="all, delete-orphan"
    )
    movements: Mapped[list["FileMovement"]] = relationship(
        back_populates="house", cascade="all, delete-orphan"
    )
