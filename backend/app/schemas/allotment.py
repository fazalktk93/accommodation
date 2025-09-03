from __future__ import annotations

from typing import Optional
from datetime import date
from pydantic import BaseModel

# Enum types are optional – import if present, else fall back to str
try:
    from app.models.allotment import QtrStatus, AllotteeStatus  # type: ignore
except Exception:
    # fallback string enums to avoid import-time failures
    class QtrStatus(str):  # type: ignore
        active = "active"
        ended = "ended"
    class AllotteeStatus(str):  # type: ignore
        in_service = "in_service"
        retired = "retired"
        cancelled = "cancelled"

class AllotmentBase(BaseModel):
    house_id: int
    person_name: Optional[str] = None
    designation: Optional[str] = None
    directorate: Optional[str] = None
    cnic: Optional[str] = None
    pool: Optional[str] = None
    medium: Optional[str] = None

    allotment_date: Optional[date] = None
    occupation_date: Optional[date] = None
    vacation_date: Optional[date] = None

    # Accept either enum or raw string values
    qtr_status: Optional[QtrStatus] = None
    allottee_status: Optional[AllotteeStatus] = None

class AllotmentCreate(AllotmentBase):
    pass

class AllotmentUpdate(BaseModel):
    person_name: Optional[str] = None
    designation: Optional[str] = None
    directorate: Optional[str] = None
    cnic: Optional[str] = None
    pool: Optional[str] = None
    medium: Optional[str] = None

    allotment_date: Optional[date] = None
    occupation_date: Optional[date] = None
    vacation_date: Optional[date] = None

    qtr_status: Optional[QtrStatus] = None
    allottee_status: Optional[AllotteeStatus] = None

class AllotmentOut(AllotmentBase):
    id: int
    period_of_stay: Optional[int] = None
    house_file_no: Optional[str] = None
    house_qtr_no: Optional[int] = None

    class Config:
        orm_mode = True
