from __future__ import annotations
from datetime import date as dt_date
from typing import Optional, List
from fastapi import HTTPException, status
from sqlalchemy import select, and_, desc
from sqlalchemy.orm import Session
from app.models import House, Allotment, QtrStatus
from app.schemas import allotment as s

def _is_active(a: Allotment) -> bool:
    return a.qtr_status == QtrStatus.active

def _sync_house_status(db: Session, a: Optional[Allotment]) -> None:
    if not a:
        return
    h = db.get(House, a.house_id)
    if not h:
        return
    if getattr(h, "status_manual", False):
        return
    h.status = "occupied" if _is_active(a) else "vacant"
    db.add(h)

def _recompute_house_status(db: Session, house_id: int) -> None:
    h = db.get(House, house_id)
    if not h or getattr(h, "status_manual", False):
        return
    latest = (
        db.execute(select(Allotment).where(Allotment.house_id == house_id)
                  .order_by(Allotment.id.desc()).limit(1))
        .scalars().first()
    )
    h.status = "occupied" if (latest and _is_active(latest)) else "vacant"
    db.add(h)

def get(db: Session, allotment_id: int) -> Allotment:
    obj = db.get(Allotment, allotment_id)
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Allotment not found")
    return obj

def list(db: Session, skip=0, limit=50, house_id: Optional[int] = None,
         active: Optional[bool] = None, person_name: Optional[str] = None,
         file_no: Optional[str] = None, qtr_no: Optional[int] = None) -> List[Allotment]:
    from app.models import House as H
    stmt = select(Allotment).join(H)
    conds = []
    if house_id is not None:
        conds.append(Allotment.house_id == house_id)
    if active is not None:
        conds.append(Allotment.qtr_status == (QtrStatus.active if active else QtrStatus.ended))
    if person_name:
        conds.append(Allotment.person_name.ilike(f"%{person_name}%"))
    if file_no:
        conds.append(H.file_no.ilike(f"%{file_no}%"))
    if qtr_no is not None:
        conds.append(H.qtr_no == qtr_no)
    if conds:
        stmt = stmt.where(and_(*conds))
    occ = Allotment.occupation_date
    stmt = stmt.order_by(occ.is_(None), desc(occ), desc(Allotment.id)).offset(skip).limit(limit)
    return db.execute(stmt).scalars().all()

def create(db: Session, obj_in: s.AllotmentCreate) -> Allotment:
    obj = Allotment(**obj_in.dict())
    db.add(obj); db.flush()
    _sync_house_status(db, obj)
    db.commit(); db.refresh(obj)
    return obj

def update(db: Session, allotment_id: int, obj_in: s.AllotmentUpdate) -> Allotment:
    obj = get(db, allotment_id)
    data = obj_in.dict(exclude_unset=True)
    for k, v in data.items():
        setattr(obj, k, v)
    db.add(obj)
    _sync_house_status(db, obj)
    db.commit(); db.refresh(obj)
    return obj

def end(db: Session, allotment_id: int, notes: Optional[str] = None,
        vacation_date: Optional[dt_date] = None) -> Allotment:
    obj = get(db, allotment_id)
    obj.qtr_status = QtrStatus.ended
    if vacation_date:
        obj.vacation_date = vacation_date
    if notes:
        obj.notes = (obj.notes + "\n" if obj.notes else "") + notes
    db.add(obj)
    _sync_house_status(db, obj)
    db.commit(); db.refresh(obj)
    return obj

def delete(db: Session, allotment_id: int) -> None:
    obj = get(db, allotment_id)
    hid = obj.house_id
    db.delete(obj)
    _recompute_house_status(db, hid)
    db.commit()
