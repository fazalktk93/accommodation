from typing import Optional
from datetime import date
from pydantic import BaseModel
from app.models.allotment import QtrStatus, AllotteeStatus

class AllotmentBase(BaseModel):
    house_id: int
    person_name: Optional[str] = None
    designation: Optional[str] = None
    directorate: Optional[str] = None
    cnic: Optional[str] = None
    pool: Optional[str] = None
    medium: Optional[str] = None
    bps: Optional[int] = None

    allotment_date: Optional[date] = None
    occupation_date: Optional[date] = None
    vacation_date: Optional[date] = None
    dob: Optional[date] = None
    dor: Optional[date] = None
    retention_until: Optional[date] = None
    retention_last: Optional[date] = None

    qtr_status: QtrStatus = QtrStatus.active
    allottee_status: AllotteeStatus = AllotteeStatus.in_service
    notes: Optional[str] = None

class AllotmentCreate(AllotmentBase):
    pass

class AllotmentUpdate(BaseModel):
    person_name: Optional[str] = None
    designation: Optional[str] = None
    directorate: Optional[str] = None
    cnic: Optional[str] = None
    pool: Optional[str] = None
    medium: Optional[str] = None
    bps: Optional[int] = None

    allotment_date: Optional[date] = None
    occupation_date: Optional[date] = None
    vacation_date: Optional[date] = None
    dob: Optional[date] = None
    dor: Optional[date] = None
    retention_until: Optional[date] = None
    retention_last: Optional[date] = None

    qtr_status: Optional[QtrStatus] = None
    allottee_status: Optional[AllotteeStatus] = None
    notes: Optional[str] = None

class AllotmentOut(AllotmentBase):
    id: int
    period_of_stay: Optional[int] = None
    house_file_no: Optional[str] = None
    house_qtr_no: Optional[int] = None

    class Config:
        orm_mode = True
