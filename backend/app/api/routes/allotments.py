from __future__ import annotations
from datetime import date, datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.security import get_current_user, require_permissions
from app.api.deps import get_db
from app.schemas import allotment as s
from app.crud import allotment as crud
from app.crud import house as crud_house
from app.models import House, Allotment, QtrStatus, AllotteeStatus
from app.models.user import Role

router = APIRouter(prefix="/allotments", tags=["allotments"])

# ---------- helpers ----------

def _period(start: Optional[date], end: Optional[date]) -> Optional[int]:
    if not start:
        return None
    end = end or date.today()
    try:
        return (end - start).days
    except Exception:
        return None

def _add_months(d: date, months: int) -> date:
    """Add calendar months, clamping to end of target month."""
    y, m = d.year, d.month
    y2 = y + (m - 1 + months) // 12
    m2 = (m - 1 + months) % 12 + 1
    import calendar
    last = calendar.monthrange(y2, m2)[1]
    day = min(d.day, last)
    return date(y2, m2, day)

def _compute_retention_until(dor: Optional[date], explicit: Optional[date]) -> Optional[date]:
    """Prefer explicit retention_until if valid; else DOR + 6 calendar months."""
    if explicit and dor:
        return explicit if explicit >= dor else _add_months(dor, 6)
    if explicit and not dor:
        return explicit
    if dor:
        return _add_months(dor, 6)
    return None

def _retention_status(dor: Optional[date], until: Optional[date], today: Optional[date] = None) -> str:
    t = today or date.today()
    if not dor or t < dor:
        return "in-service"
    if until and t <= until:
        return "retention"
    return "unauthorized"

def _maybe_auto_retention(db: Session, a: Allotment) -> bool:
    """
    Ensure allottee_status reflects DOR/retention window.
    Returns True if we changed the row.
    """
    changed = False
    dor: Optional[date] = getattr(a, "dor", None)
    explicit_until: Optional[date] = getattr(a, "retention_until", None)
    ru = _compute_retention_until(dor, explicit_until)
    status = _retention_status(dor, ru)

    # Do not auto-change if already retired/cancelled
    if a.allottee_status in (AllotteeStatus.cancelled, AllotteeStatus.retired):
        return False

    desired = None
    if status == "retention":
        desired = getattr(AllotteeStatus, "retention", None)
    elif status == "unauthorized":
        # only if enum has it; otherwise leave as-is
        desired = getattr(AllotteeStatus, "unauthorized", None)

    if desired and a.allottee_status != desired:
        a.allottee_status = desired
        db.add(a)
        db.flush()
        changed = True

    return changed

def _serialize_allotment(a: Allotment, house: Optional[House]) -> s.AllotmentOut:
    """Build AllotmentOut with computed retention fields + house decorations."""
    qtr_str = None
    if house and getattr(house, "qtr_no", None) is not None:
        qtr_str = str(house.qtr_no)

    dor: Optional[date] = getattr(a, "dor", None)
    explicit_until: Optional[date] = getattr(a, "retention_until", None)
    ru = _compute_retention_until(dor, explicit_until)
    status = _retention_status(dor, ru)

    # NOTE: Pydantic will isoformat date fields
    base = s.AllotmentOut.from_orm(a)
    return base.copy(update={
        "period_of_stay": _period(a.occupation_date, a.vacation_date),
        "house_file_no": getattr(house, "file_no", None) if house else None,
        "house_qtr_no": qtr_str,
        "house_sector": getattr(house, "sector", None) if house else None,
        "house_street": getattr(house, "street", None) if house else None,
        "house_type_code": getattr(house, "type_code", None) if house else None,

        # computed retention fields:
        "retention_until": ru,
        "retention_status": status,
    })

# ---------- routes ----------

@router.get("/", response_model=List[s.AllotmentOut])
def list_allotments(
    skip: int = 0,
    limit: int = Query(100, ge=1, le=10000),
    house_id: Optional[int] = None,
    active: Optional[bool] = None,
    person_name: Optional[str] = None,
    file_no: Optional[str] = None,
    qtr_no: Optional[str] = None,
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    rows = crud.list(
        db,
        skip=skip,
        limit=limit,
        house_id=house_id,
        active=active,
        person_name=person_name,
        file_no=file_no,
        qtr_no=qtr_no,
        q=q,
    )

    out: List[s.AllotmentOut] = []
    for a in rows:
        # auto-retention / unauthorized enforcement
        if _maybe_auto_retention(db, a):
            db.commit()
            db.refresh(a)

        house = db.get(House, a.house_id)
        out.append(_serialize_allotment(a, house))
    return out

@router.get("/{allotment_id}", response_model=s.AllotmentOut)
def get_allotment(
    allotment_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_permissions("allotments:read")),
):
    a = crud.get(db, allotment_id)
    if not a:
        raise HTTPException(status_code=404, detail="Allotment not found")

    # auto-retention / unauthorized enforcement
    if _maybe_auto_retention(db, a):
        db.commit()
        db.refresh(a)

    house = db.get(House, a.house_id)
    return _serialize_allotment(a, house)

@router.post("/", response_model=s.AllotmentOut, status_code=201)
def create_allotment(
    payload: s.AllotmentCreate,
    db: Session = Depends(get_db),
    user=Depends(require_permissions("allotments:create")),
):
    a = crud.create(db, payload)
    house = db.get(House, a.house_id)
    # enforce status right away
    if _maybe_auto_retention(db, a):
        db.commit()
        db.refresh(a)
    return _serialize_allotment(a, house)

@router.patch("/{allotment_id}", response_model=s.AllotmentOut)
def update_allotment(
    allotment_id: int,
    payload: s.AllotmentUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_permissions("allotments:update")),
):
    a = crud.update(db, allotment_id, payload)
    # apply auto retention/unauthorized if needed after update
    if _maybe_auto_retention(db, a):
        db.commit()
        db.refresh(a)
    house = db.get(House, a.house_id)
    return _serialize_allotment(a, house)

@router.delete("/{allotment_id}", status_code=204)
def delete_allotment(
    allotment_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_permissions('allotments:delete')),
):
    crud.delete(db, allotment_id)
    return None

class EndPayload(s.BaseModel if hasattr(s, "BaseModel") else object):
    notes: Optional[str] = None
    vacation_date: Optional[date] = None

@router.post("/{allotment_id}/end", response_model=getattr(s, "AllotmentOut", None))
def end_allotment(
    allotment_id: int,
    payload: Optional[EndPayload] = Body(None),
    db: Session = Depends(get_db),
    user=Depends(require_permissions("allotments:update")),
):
    # keep your existing end logic; ensure we serialize with computed fields
    a = crud.allotment.end(  # type: ignore[attr-defined]
        db,
        allotment_id,
        notes=(payload.notes if payload else None),
        vacation_date=(payload.vacation_date if payload else None),
    )
    if not a:
        raise HTTPException(status_code=404, detail="Allotment not found")
    if _maybe_auto_retention(db, a):
        db.commit()
        db.refresh(a)
    house = db.get(House, a.house_id)
    return _serialize_allotment(a, house)
