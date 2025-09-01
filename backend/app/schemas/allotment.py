from pydantic import BaseModel, root_validator, validator
from datetime import date
from typing import Optional

class AllotmentBase(BaseModel):
    # allow either house_id or file_no from client (we'll resolve to house_id)
    house_id: Optional[int] = None
    file_no: Optional[str] = None

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
        if not v: return v
        digits = [d for d in v if d.isdigit()]
        if len(digits) != 13:
            raise ValueError("CNIC must have 13 digits.")
        return v

    @root_validator
    def one_of_house_or_file(cls, values):
        if not values.get("house_id") and not values.get("file_no"):
            raise ValueError("Provide either house_id or file_no")
        return values

class AllotmentCreate(AllotmentBase):
    pass

class AllotmentUpdate(BaseModel):
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
