from pydantic import BaseModel, validator
from datetime import date
from typing import Optional

class AllotmentBase(BaseModel):
    house_id: int

    allottee_name: str
    designation: Optional[str] = None
    bps: Optional[int] = None
    directorate: Optional[str] = None
    cnic: Optional[str] = None

    allotment_date: date
    date_of_birth: date
    pool: Optional[str] = None
    qtr_status: Optional[str] = None
    accommodation_type: Optional[str] = None
    occupation_date: Optional[date] = None
    allotment_medium: Optional[str] = None
    vacation_date: Optional[date] = None

    notes: Optional[str] = None

    @validator("cnic")
    def validate_cnic(cls, v):
        if not v:
            return v
        # Accepts 13 digits with or without dashes
        digits = [d for d in v if d.isdigit()]
        if len(digits) != 13:
            raise ValueError("CNIC must have 13 digits.")
        return v

class AllotmentCreate(AllotmentBase):
    pass

class AllotmentUpdate(BaseModel):
    # update any field; active/superannuation_date handled by server
    allottee_name: Optional[str] = None
    designation: Optional[str] = None
    bps: Optional[int] = None
    directorate: Optional[str] = None
    cnic: Optional[str] = None

    allotment_date: Optional[date] = None
    date_of_birth: Optional[date] = None
    pool: Optional[str] = None
    qtr_status: Optional[str] = None
    accommodation_type: Optional[str] = None
    occupation_date: Optional[date] = None
    allotment_medium: Optional[str] = None
    vacation_date: Optional[date] = None

    notes: Optional[str] = None

class Allotment(AllotmentBase):
    id: int
    superannuation_date: date
    active: bool
    end_date: Optional[date] = None

    class Config:
        orm_mode = True
