from __future__ import annotations
from datetime import date
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session

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

def _maybe_auto_retention(db: Session, a: Allotment) -> bool:
    """Ensure retention is set if DOR has passed; returns True if changed."""
    changed = False
    if getattr(a, 'dor', None) and a.dor <= date.today():
        if a.allottee_status not in (AllotteeStatus.cancelled, AllotteeStatus.retired):
            if a.allottee_status != AllotteeStatus.retention:
                a.allottee_status = AllotteeStatus.retention
                db.add(a)
                db.flush()
                changed = True
    return changed

# ---------- routes ----------

@router.get("/", response_model=List[s.AllotmentOut])
def list_allotments(
    skip: int = 0,
    limit: int = Query(100, ge=1),
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
        # auto-retention enforcement
        if _maybe_auto_retention(db, a):
            db.commit()
            db.refresh(a)

        house = db.get(House, a.house_id)
        qtr_str = None
        if house and getattr(house, "qtr_no", None) is not None:
            qtr_str = str(house.qtr_no)

        item = s.AllotmentOut.from_orm(a).copy(update={
            "period_of_stay": _period(a.occupation_date, a.vacation_date),
            "house_file_no": getattr(house, "file_no", None) if house else None,
            "house_qtr_no": qtr_str,
            "house_sector": getattr(house, "sector", None) if house else None,
            "house_street": getattr(house, "street", None) if house else None,
            "house_type_code": getattr(house, "type_code", None) if house else None,
        })
        out.append(item)
    return out

@router.get("/{allotment_id}", response_model=s.AllotmentOut)
def get_allotment(
    allotment_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_permissions("allotments:read")),
):
    a = crud.get(db, allotment_id)
    _maybe_auto_retention(db, a)
    db.commit()
    db.refresh(a)
    house = db.get(House, a.house_id)
    qtr_str = None
    if house and getattr(house, "qtr_no", None) is not None:
        qtr_str = str(house.qtr_no)
    return s.AllotmentOut.from_orm(a).copy(update={
        "period_of_stay": _period(a.occupation_date, a.vacation_date),
        "house_file_no": getattr(house, "file_no", None) if house else None,
        "house_qtr_no": qtr_str,
        "house_sector": getattr(house, "sector", None) if house else None,
        "house_street": getattr(house, "street", None) if house else None,
        "house_type_code": getattr(house, "type_code", None) if house else None,
    })

@router.post("/", response_model=s.AllotmentOut, status_code=201)
def create_allotment(
    payload: s.AllotmentCreate,
    db: Session = Depends(get_db),
    user=Depends(require_permissions("allotments:create")),
):
    a = crud.create(db, payload)
    house = db.get(House, a.house_id)
    return s.AllotmentOut.from_orm(a).copy(update={
        "period_of_stay": _period(a.occupation_date, a.vacation_date),
        "house_file_no": getattr(house, "file_no", None) if house else None,
        "house_qtr_no": str(getattr(house, "qtr_no", "")) if house else None,
        "house_sector": getattr(house, "sector", None) if house else None,
        "house_street": getattr(house, "street", None) if house else None,
        "house_type_code": getattr(house, "type_code", None) if house else None,
    })

@router.patch("/{allotment_id}", response_model=s.AllotmentOut)
def update_allotment(
    allotment_id: int,
    payload: s.AllotmentUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_permissions("allotments:update")),
):
    a = crud.update(db, allotment_id, payload)
    # apply auto retention if needed after update
    _maybe_auto_retention(db, a)
    db.commit()
    db.refresh(a)
    house = db.get(House, a.house_id)
    return s.AllotmentOut.from_orm(a).copy(update={
        "period_of_stay": _period(a.occupation_date, a.vacation_date),
        "house_file_no": getattr(house, "file_no", None) if house else None,
        "house_qtr_no": str(getattr(house, "qtr_no", "")) if house else None,
        "house_sector": getattr(house, "sector", None) if house else None,
        "house_street": getattr(house, "street", None) if house else None,
        "house_type_code": getattr(house, "type_code", None) if house else None,
    })

@router.delete("/{allotment_id}", status_code=204)
def delete_allotment(
    allotment_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_permissions('allotments:delete')),
):
    crud.delete(db, allotment_id)
    return None

class EndPayload(s.BaseModel if hasattr(s, "BaseModel") else object):  # fallback if you don't re-export BaseModel
    notes: Optional[str] = None
    vacation_date: Optional[date] = None

@router.post("/{allotment_id}/end", response_model=getattr(s, "AllotmentOut", None))
def end_allotment(
    allotment_id: int,
    payload: Optional[EndPayload] = Body(None),
    db: Session = Depends(get_db),
):
    return crud.allotment.end(
        db,
        allotment_id,
        notes=(payload.notes if payload else None),
        vacation_date=(payload.vacation_date if payload else None),
    )