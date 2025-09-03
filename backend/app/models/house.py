from __future__ import annotations
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship

class HouseStatus:
    VACANT = "vacant"
    OCCUPIED = "occupied"
    MAINTENANCE = "maintenance"

class House(SQLModel, table=True):
    __tablename__ = "house"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Canonical identifiers
    file_no: str = Field(index=True)
    qtr_no: Optional[int] = Field(default=None, index=True)
    street: Optional[str] = Field(default=None, index=True)
    sector: Optional[str] = Field(default=None, index=True)
    type_code: Optional[str] = Field(default=None, index=True)

    # Header status
    status: str = Field(default=HouseStatus.VACANT)
    status_manual: bool = Field(default=False)

    # Back relation
    allotments: List["Allotment"] = Relationship(back_populates="house")
