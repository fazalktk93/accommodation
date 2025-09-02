from datetime import date
from pydantic import BaseModel, Field, validator
import re

CNIC_RE = re.compile(r"^\d{5}-\d{7}-\d{1}$|^\d{13}$")
ALLOWED_MEDIUM = {"family transfer", "changes", "mutual", "other"}

class AllotmentBase(BaseModel):
    house_id: int
    person_name: str = Field(..., max_length=120)
    designation: str | None = None
    bps: int | None = None
    directorate: str | None = None
    cnic: str | None = None

    allotment_date: date | None = None
    date_of_birth: date | None = None
    date_of_retirement: date | None = None
    occupation_date: date | None = None
    vacation_date: date | None = None

    retention: bool | None = None
    retention_last_date: date | None = None

    pool: str | None = None
    qtr_status: str | None = None
    allotment_medium: str | None = None  # family transfer / changes / mutual / other
    active: bool | None = True
    notes: str | None = None

    @validator("cnic")
    def validate_cnic(cls, v):
        if v and not CNIC_RE.match(v):
            raise ValueError("Invalid CNIC (use xxxxx-xxxxxxx-x or 13 digits)")
        return v

    @validator("allotment_medium")
    def normalize_medium(cls, v):
        if v is None: return v
        vv = v.strip().lower()
        return vv if vv in ALLOWED_MEDIUM else "other"

class AllotmentCreate(AllotmentBase):
    pass

class AllotmentOut(AllotmentBase):
    id: int
    # computed fields
    period_of_stay: int | None = None  # days from occupation_date to vacation_date (or today)
    # convenience house info
    house_file_no: str | None = None
    house_qtr_no: int | None = None

    class Config:
