from datetime import date
from pydantic import BaseModel, Field, validator
from pydantic import BaseModel
from datetime import date
from app.models.allotment import AllotteeStatus, QtrStatus
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
    
    occupation_date: date | None = None
    vacation_date: date | None = None
    qtr_status: QtrStatus
    allottee_status: AllotteeStatus
    
    allotment_date: date | None = None
    date_of_birth: date | None = None
    date_of_retirement: date | None = None
    occupation_date: date | None = None
    vacation_date: date | None = None

    retention: bool | None = None
    retention_last_date: date | None = None

    pool: str | None = None
    qtr_status: str | None = None
    allotment_medium: str | None = None
    active: bool | None = True
    notes: str | None = None

    @validator("cnic")
    def validate_cnic(cls, v):
        if v and not CNIC_RE.match(v):
            raise ValueError("Invalid CNIC (use xxxxx-xxxxxxx-x or 13 digits)")
        return v

    @validator("allotment_medium")
    def normalize_medium(cls, v):
        if v is None:
            return v
        vv = v.strip().lower()
        return vv if vv in ALLOWED_MEDIUM else "other"

class AllotmentCreate(AllotmentBase):
    pass

class AllotmentOut(AllotmentBase):
    id: int
    period_of_stay: int | None = None  # (vacation_date or today) - occupation_date
    house_file_no: str | None = None
    house_qtr_no: int | None = None

    class Config:
        orm_mode = True

class AllotmentUpdate(BaseModel):
    # make all optional for PATCH/PUT
    occupation_date: date | None = None
    vacation_date: date | None = None
    qtr_status: QtrStatus | None = None
    allottee_status: AllotteeStatus | None = None