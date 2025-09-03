from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Integer
from enum import Enum
from sqlmodel import SQLModel, Field, Relationship, Column, String, Boolean
from .base import Base

class HouseStatus(str, Enum):
    vacant = "vacant"
    occupied = "occupied"
    maintenance = "maintenance"

class House(Base):
    __tablename__ = "houses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    file_no: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    qtr_no: Mapped[int] = mapped_column(Integer, nullable=False)
    street: Mapped[str] = mapped_column(String(120), nullable=False)
    sector: Mapped[str] = mapped_column(String(64), nullable=False)
    type_code: Mapped[str] = mapped_column(String(1), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default='available')

    allotments = relationship("Allotment", back_populates="house", cascade="all, delete-orphan")
    movements = relationship("FileMovement", back_populates="house", cascade="all, delete-orphan")

class House(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    # ...
    status: HouseStatus = Field(default=HouseStatus.vacant)
    status_manual: bool = Field(default=False)  # if True, don't auto-derive from allotments
    allotments: list["Allotment"] = Relationship(back_populates="house")