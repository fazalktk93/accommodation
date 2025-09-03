from __future__ import annotations
from typing import Optional
from enum import Enum
from datetime import date
from sqlmodel import SQLModel, Field, Relationship

class QtrStatus(str, Enum):
    active = "active"    # occupied
    ended = "ended"      # vacated

class AllotteeStatus(str, Enum):
    in_service = "in_service"
    retired = "retired"
    cancelled = "cancelled"

class Allotment(SQLModel, table=True):
    __tablename__ = "allotment"

    id: Optional[int] = Field(default=None, primary_key=True)
    house_id: int = Field(foreign_key="house.id", index=True)

    # Person / meta (extend as needed)
    person_name: Optional[str] = Field(default=None, index=True)
    designation: Optional[str] = None
    directorate: Optional[str] = None
    cnic: Optional[str] = None
    pool: Optional[str] = None
    medium: Optional[str] = None
    bps: Optional[int] = None

    # Dates
    allotment_date: Optional[date] = None
    occupation_date: Optional[date] = None
    vacation_date: Optional[date] = None
    dob: Optional[date] = None
    dor: Optional[date] = None
    retention_until: Optional[date] = None
    retention_last: Optional[date] = None

    # Status
    qtr_status: QtrStatus = Field(default=QtrStatus.active)
    allottee_status: AllotteeStatus = Field(default=AllotteeStatus.in_service)
    notes: Optional[str] = None

    # Back relation
    house: Optional["House"] = Relationship(back_populates="allotments")
