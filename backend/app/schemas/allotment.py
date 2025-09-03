from __future__ import annotations

from typing import Optional, Any
from datetime import date, datetime
from pydantic import BaseModel, validator
from app.models.allotment import QtrStatus, AllotteeStatus


def _parse_date_any(v: Any) -> Optional[date]:
    if v is None or v == "" or str(v).lower() == "null":
        return None
    if isinstance(v, date):
        return v
    s = str(v).strip()
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    # not parseable -> let it be None instead of 422
    return None


def _parse_int_any(v: Any) -> Optional[int]:
    if v is None or v == "" or str(v).lower() == "null":
        return None
    try:
        return int(v)
    except Exception:
        return None


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

    # --- coercion for numeric + dates (when subclasses use pre=True validators) ---
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


# -------- Flexible input model for CREATE --------
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

    # Accept either the enum string/case-insensitive or an 'active' boolean
    qtr_status: Optional[QtrStatus] = None
    active: Optional[bool] = None
    allottee_status: Optional[AllotteeStatus] = None
    notes: Optional[str] = None

    # Coercion
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

    @validator("qtr_status", pre=True, always=False)
    def _v_qtr_status(cls, v):  # noqa
        if v is None or v == "":
            return None
        if isinstance(v, QtrStatus):
            return v
        s = str(v).strip().lower()
        if s in ("active", "occupied", "ongoing", "current", "true"):
            return QtrStatus.active
        if s in ("ended", "vacated", "inactive", "closed", "false"):
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
