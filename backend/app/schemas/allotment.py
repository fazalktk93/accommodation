# backend/app/schemas/allotment.py
from __future__ import annotations

from typing import Optional, Any
from datetime import date, datetime
from pydantic import BaseModel, validator

# Import enums into this module's namespace so routes can use s.AllotteeStatus / s.QtrStatus
from app.models.allotment import QtrStatus, AllotteeStatus


# ---------- helpers for tolerant parsing ----------

def _parse_date_any(v: Any) -> Optional[date]:
    if v is None:
        return None
    s = str(v).strip()
    if s == "" or s.lower() == "null":
        return None
    if isinstance(v, date):
        return v
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    # not parseable → return None instead of raising 422
    return None


def _parse_int_any(v: Any) -> Optional[int]:
    if v is None:
        return None
    s = str(v).strip()
    if s == "" or s.lower() == "null":
        return None
    try:
        return int(s)
    except Exception:
        return None


# ---------- base & standard schemas ----------

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
    dor: Optional[date] = None
    retention_until: Optional[date] = None
    retention_last: Optional[date] = None

    qtr_status: QtrStatus = QtrStatus.active
    allottee_status: AllotteeStatus = AllotteeStatus.in_service
    notes: Optional[str] = None

    # coercion
    @validator("bps", pre=True, always=False)
    def _v_bps(cls, v):  # noqa
        return _parse_int_any(v)

    @validator(
        "allotment_date",
        "occupation_date",
        "vacation_date",
        "dob",
        "dor",
        "retention_until",
        "retention_last",
        pre=True,
        always=False,
    )
    def _v_dates(cls, v):  # noqa
        return _parse_date_any(v)

class AllotmentOutFull(AllotmentBase):
    dob: date | None = None   # included
    
class AllotmentOutRestricted(AllotmentBase):
    pass

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

    # same coercion for partial updates
    @validator("bps", pre=True, always=False)
    def _v_bps_u(cls, v):  # noqa
        return _parse_int_any(v)

    @validator(
        "allotment_date",
        "occupation_date",
        "vacation_date",
        "dob",
        "dor",
        "retention_until",
        "retention_last",
        pre=True,
        always=False,
    )
    def _v_dates_u(cls, v):  # noqa
        return _parse_date_any(v)


# ---------- flexible CREATE payload (for forgiving frontend inputs) ----------

class AllotmentCreateFlexible(BaseModel):
    # Either house_id OR house_file_no is accepted
    house_id: Optional[int] = None
    house_file_no: Optional[str] = None

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

    # Accept either enum-like strings or a boolean 'active'
    qtr_status: Optional[QtrStatus] = None
    active: Optional[bool] = None
    allottee_status: Optional[AllotteeStatus] = None
    notes: Optional[str] = None

    # coercion
    @validator("bps", pre=True, always=False)
    def _v_bps_f(cls, v):  # noqa
        return _parse_int_any(v)

    @validator(
        "allotment_date",
        "occupation_date",
        "vacation_date",
        "dob",
        "dor",
        "retention_until",
        "retention_last",
        pre=True,
        always=False,
    )
    def _v_dates_f(cls, v):  # noqa
        return _parse_date_any(v)

    @validator("qtr_status", pre=True, always=False)
    def _v_qtr_status(cls, v):  # noqa
        if v is None or v == "":
            return None
        if isinstance(v, QtrStatus):
            return v
        s = str(v).strip().lower()
        if s in ("active", "occupied", "ongoing", "current", "true", "1"):
            return QtrStatus.active
        if s in ("ended", "vacated", "inactive", "closed", "false", "0"):
            return QtrStatus.ended
        return QtrStatus.active

    @validator("allottee_status", pre=True, always=False)
    def _v_allottee_status(cls, v):  # noqa
        if v is None or v == "":
            return None
        if isinstance(v, AllotteeStatus):
            return v
        s = str(v).strip().lower().replace(" ", "_")
        if s in ("in_service", "inservice", "serving"):
            return AllotteeStatus.in_service
        if s in ("retired",):
            return AllotteeStatus.retired
        if s in ("cancelled", "canceled"):
            return AllotteeStatus.cancelled
        return AllotteeStatus.in_service


# ---------- output schema returned by routes ----------

class AllotmentOut(AllotmentBase):
    id: int
    # computed fields filled in routes
    period_of_stay: Optional[int] = None
    house_file_no: Optional[str] = None
    house_qtr_no: Optional[str] = None
    house_sector: Optional[str] = None
    house_street: Optional[str] = None
    house_type_code: Optional[str] = None

    class Config:
        orm_mode = True
