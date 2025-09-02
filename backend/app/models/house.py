from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Integer
from .base import Base

class House(Base):
    __tablename__ = "houses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    file_no: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    qtr_no: Mapped[int] = mapped_column(Integer, nullable=False)
    sector: Mapped[str] = mapped_column(String(64), nullable=False)

    allotments = relationship("Allotment", back_populates="house", cascade="all, delete-orphan")
    movements = relationship("FileMovement", back_populates="house", cascade="all, delete-orphan")
