from __future__ import annotations
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship

class House(SQLModel, table=True):
    __tablename__ = "house"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Canonical identifiers used throughout the app
    file_no: str = Field(index=True)
    qtr_no: Optional[int] = Field(default=None, index=True)
    street: Optional[str] = Field(default=None, index=True)
    sector: Optional[str] = Field(default=None, index=True)
    type_code: Optional[str] = Field(default=None, index=True)

    # Top header status
    status: str = Field(default="vacant")          # 'vacant' | 'occupied' | 'maintenance'
    status_manual: bool = Field(default=False)

    # Relation to allotments
    allotments: List["Allotment"] = Relationship(back_populates="house")
