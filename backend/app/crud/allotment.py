from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import select
from fastapi import HTTPException, status
from app import models
from app.schemas import allotment as s

def get(db: Session, allotment_id: int) -> models.Allotment:
    obj = db.get(models.Allotment, allotment_id)
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Allotment not found")
    return obj

def list(db: Session, skip=0, limit=50, house_id=None, active=None):
    stmt = select(models.Allotment)
    if house_id is not None:
        stmt = stmt.where(models.Allotment.house_id == house_id)
    if active is not None:
        stmt = stmt.where(models.Allotment.active == active)
    stmt = stmt.offset(skip).limit(limit)
    return db.execute(stmt).scalars().all()

def create(db: Session, obj_in: s.AllotmentCreate) -> models.Allotment:
    obj = models.Allotment(**obj_in.dict())
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

def end(db: Session, allotment_id: int,
        notes: Optional[str] = None, vacation_date: Optional[s.date] = None):
    obj = get(db, allotment_id)
    if not obj.active:
        return obj
    obj.active = False
    if vacation_date:
        obj.vacation_date = vacation_date
    if notes:
        obj.notes = (obj.notes + "\n" if obj.notes else "") + notes
    db.add(obj); db.commit(); db.refresh(obj)
    return obj
