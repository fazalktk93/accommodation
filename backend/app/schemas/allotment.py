# backend/app/schemas/allotment.py
from __future__ import annotations

from typing import Optional, Any, List
from datetime import date, datetime
from pydantic import BaseModel, validator

from app.models.allotment import QtrStatus, AllotteeStatus

# ---------- helpers ----------
def _parse_date_any(v: Any) -> Optional[date]:
    if v is None:
        return None
    if isinstance(v, date) and not isinstance(v, datetime):
        return v
    if isinstance(v, datetime):
        return v.date()
    s = str(v).strip()
    if not s or s.lower() == 'null':
        return None
    try:
        # support YYYY-MM-DD
        parts = [int(x) for x in s[:10].split('-')]
        if len(parts) == 3:
            return date(parts[0], parts[1], parts[2])
    except Exception:
        pass
    return None

def _parse_int_any(v: Any) -> Optional[int]:
    if v is None:
        return None
    s = str(v).strip()
    if s == '' or s.lower() == 'null':
        return None
    try:
        return int(s)
    except Exception:
        return None

ALLOWED_POOLS = {'CDA': 'CDA', 'ESTATE OFFICE': 'Estate Office'}

# ---------- base ----------

class AllotmentBase(BaseModel):
    house_id: int
    person_name: str
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

    # coercion
    @validator('bps', pre=True, always=False)
    def _v_bps(cls, v):
        return _parse_int_any(v)

    @validator('allotment_date', 'occupation_date', 'vacation_date', 'dob', 'dor', 'retention_until', 'retention_last', pre=True, always=False)
    def _v_dates(cls, v):
        return _parse_date_any(v)

    @validator('pool', pre=True, always=False)
    def _v_pool(cls, v):
        if v is None:
            return None
        s = str(v).strip()
        if not s:
            return None
        key = s.replace('-', ' ').replace('.', '').strip().upper()
        if key in ALLOWED_POOLS:
            return ALLOWED_POOLS[key]
        raise ValueError("pool must be one of: CDA, Estate Office")

    @validator('allottee_status', always=True)
    def _auto_retention(cls, v, values):
        # If DOR has passed, move to retention automatically
        dor = values.get('dor')
        if isinstance(dor, datetime):
            dor = dor.date()
        if dor and isinstance(dor, date) and dor <= date.today():
            if v not in (AllotteeStatus.cancelled, AllotteeStatus.retired):
                return AllotteeStatus.retention
        return v

# ---------- create/update ----------

class AllotmentCreate(AllotmentBase):
    pass

class AllotmentUpdate(BaseModel):
    house_id: Optional[int] = None
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

    # coercion
    @validator('bps', pre=True, always=False)
    def _v_bps_u(cls, v):
        return _parse_int_any(v)

    @validator('allotment_date', 'occupation_date', 'vacation_date', 'dob', 'dor', 'retention_until', 'retention_last', pre=True, always=False)
    def _v_dates_u(cls, v):
        return _parse_date_any(v)

    @validator('pool', pre=True, always=False)
    def _v_pool_u(cls, v):
        if v is None:
            return None
        s = str(v).strip()
        if not s:
            return None
        key = s.replace('-', ' ').replace('.', '').strip().upper()
        if key in ALLOWED_POOLS:
            return ALLOWED_POOLS[key]
        raise ValueError("pool must be one of: CDA, Estate Office")

    @validator('allottee_status', always=True)
    def _auto_retention_u(cls, v, values):
        dor = values.get('dor')
        if isinstance(dor, datetime):
            dor = dor.date()
        if dor and isinstance(dor, date) and dor <= date.today():
            if v is None or v not in (AllotteeStatus.cancelled, AllotteeStatus.retired):
                return AllotteeStatus.retention
        return v

# ---------- output ----------

class AllotmentOut(AllotmentBase):
    # override fields that can be NULL in DB to accept None in responses
    person_name: Optional[str] = None
    qtr_status: Optional[QtrStatus] = None
    allottee_status: Optional[AllotteeStatus] = None
    retention_status: Optional[str] = None

    id: int
    period_of_stay: Optional[int] = None

    # denormalized house fields for the list page
    house_file_no: Optional[str] = None
    house_qtr_no: Optional[str] = None
    house_sector: Optional[str] = None
    house_street: Optional[str] = None
    house_type_code: Optional[str] = None

    class Config:
        orm_mode = True

# Restricted/full variants if needed by routes
class AllotmentOutRestricted(AllotmentOut):
    # In a real app you might drop some fields for viewers; keep same for now
    pass

class AllotmentOutFull(AllotmentOut):
    pass
