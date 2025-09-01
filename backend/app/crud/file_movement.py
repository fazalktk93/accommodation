from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from fastapi import HTTPException, status
from app import models, schemas
from app.crud.utils import paginate

def issue(db: Session, obj_in: schemas.file_movement.FileIssueCreate):
    active = db.execute(
        select(models.file_movement.FileMovement).where(
            and_(models.file_movement.FileMovement.file_code == obj_in.file_code,
                 models.file_movement.FileMovement.return_date.is_(None))
        )
    ).scalars().first()
    if active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This file is already issued and not returned.")
    obj = models.file_movement.FileMovement(**obj_in.dict())
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

def return_file(db: Session, movement_id: int, remarks: str | None = None):
    obj = db.get(models.file_movement.FileMovement, movement_id)
    if not obj: raise HTTPException(404, "Record not found")
    if obj.return_date: raise HTTPException(400, "Already returned")
    obj.return_date = datetime.utcnow()
    if remarks:
        obj.remarks = (obj.remarks + "\n" if obj.remarks else "") + remarks
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

def list(db: Session, skip: int = 0, limit: int = 50, outstanding: bool | None = None, file_code: str | None = None):
    q = db.query(models.file_movement.FileMovement)
    if outstanding is True: q = q.filter(models.file_movement.FileMovement.return_date.is_(None))
    if outstanding is False: q = q.filter(models.file_movement.FileMovement.return_date.is_not(None))
    if file_code: q = q.filter(models.file_movement.FileMovement.file_code == file_code)
    q = q.order_by(models.file_movement.FileMovement.id.desc())
    return paginate(q, skip, limit).all()

def get(db: Session, movement_id: int):
    obj = db.get(models.file_movement.FileMovement, movement_id)
    if not obj: raise HTTPException(404, "Record not found")
    return obj
