from __future__ import annotations
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_
from fastapi import HTTPException, status
from app import models
from app.schemas import allotment as s
from app.crud.utils import paginate

def create(db: Session, obj_in: s.AllotmentCreate):
    # ensure house exists
    house = db.get(models.House, obj_in.house_id)
    if not house:
        raise HTTPException(status_code=404, detail="House not found")

    # enforce one active allotment per house
    active_exists = db.query(models.Allotment).filter(
        and_(models.Allotment.house_id == obj_in.house_id,
             models.Allotment.active.is_(True))
    ).first()
    if active_exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="House already has an active allotment")

    obj = models.Allotment(
        house_id=obj_in.house_id,
        person_name=obj_in.person_name,
        cnic=obj_in.cnic,
        start_date=obj_in.start_date,
        end_date=obj_in.end_date,
        active=obj_in.active if obj_in.active is not None else True,
        notes=obj_in.notes,
    )
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

def list(db: Session, skip: int = 0, limit: int = 50,
         house_id: Optional[int] = None, active: Optional[bool] = None):
    q = db.query(models.Allotment)
    if house_id is not None:
        q = q.filter(models.Allotment.house_id == house_id)
    if active is True:
        q = q.filter(models.Allotment.active.is_(True))
    elif active is False:
        q = q.filter(models.Allotment.active.is_(False))
    q = q.order_by(models.Allotment.id.desc())
    return paginate(q, skip, limit).all()

def get(db: Session, allotment_id: int):
    obj = db.get(models.Allotment, allotment_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Allotment not found")
    return obj

def end(db: Session, allotment_id: int,
        notes: Optional[str] = None, vacation_date: Optional[s.date] = None):
    obj = get(db, allotment_id)
    if not obj.active:
        return obj
    obj.active = False
    if vacation_date:
        obj.end_date = vacation_date
    if notes:
        obj.notes = (obj.notes + "\n" if obj.notes else "") + notes
    db.add(obj); db.commit(); db.refresh(obj)
    return obj
