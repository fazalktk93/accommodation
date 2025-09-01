from datetime import datetime
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from app import models, schemas
from app.crud.utils import paginate

def create(db: Session, obj_in: schemas.allotment.AllotmentCreate):
    active = db.execute(
        select(models.allotment.Allotment).where(
            and_(models.allotment.Allotment.house_id == obj_in.house_id,
                 models.allotment.Allotment.end_date.is_(None))
        )
    ).scalars().first()
    if active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This house already has an active allotment.")
    data = obj_in.dict()
    if not data.get("start_date"):
        data["start_date"] = datetime.utcnow()
    obj = models.allotment.Allotment(**data)
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

def end(db: Session, allotment_id: int, notes: str | None = None):
    obj = db.get(models.allotment.Allotment, allotment_id)
    if not obj: raise HTTPException(404, "Allotment not found")
    if obj.end_date: raise HTTPException(400, "Allotment already ended")
    obj.end_date = datetime.utcnow()
    if notes:
        obj.notes = (obj.notes + "\n" if obj.notes else "") + notes
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

def list(db: Session, skip: int = 0, limit: int = 50, house_id: int | None = None, active: bool | None = None):
    q = db.query(models.allotment.Allotment)
    if house_id is not None: q = q.filter(models.allotment.Allotment.house_id == house_id)
    if active is True: q = q.filter(models.allotment.Allotment.end_date.is_(None))
    if active is False: q = q.filter(models.allotment.Allotment.end_date.is_not(None))
    q = q.order_by(models.allotment.Allotment.id.desc())
    return paginate(q, skip, limit).all()

def get(db: Session, allotment_id: int):
    obj = db.get(models.allotment.Allotment, allotment_id)
    if not obj: raise HTTPException(404, "Allotment not found")
    return obj
