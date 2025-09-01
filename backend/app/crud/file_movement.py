from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from fastapi import HTTPException, status
from typing import Optional
from app import models, schemas
from app.crud import house as house_crud
from app.crud.utils import paginate

def issue(db: Session, obj_in: schemas.file_movement.FileIssueCreate):
    # resolve house by file_no if provided
    house_id = obj_in.house_id
    if not house_id and obj_in.file_no:
        house_id = house_crud.get_by_file_no(db, obj_in.file_no).id

    # ensure not already issued (outstanding) for this house
    active = db.execute(
        select(models.file_movement.FileMovement).where(
            and_(models.file_movement.FileMovement.house_id == house_id,
                 models.file_movement.FileMovement.return_date.is_(None))
        )
    ).scalars().first()
    if active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This file is already issued and not returned.")

    house = house_crud.get(db, house_id)
    data = obj_in.dict(exclude={"file_no"})
    data["house_id"] = house_id
    data["file_no"] = house.file_no

    obj = models.file_movement.FileMovement(**data)
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

def return_file(db: Session, movement_id: int, remarks: Optional[str] = None):
    obj = db.get(models.file_movement.FileMovement, movement_id)
    if not obj: raise HTTPException(404, "Record not found")
    if obj.return_date: raise HTTPException(400, "Already returned")
    from datetime import datetime
    obj.return_date = datetime.utcnow()
    if remarks: obj.remarks = (obj.remarks + "\n" if obj.remarks else "") + remarks
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

def list(db: Session, skip: int = 0, limit: int = 50, outstanding: Optional[bool] = None, file_no: Optional[str] = None):
    q = db.query(models.file_movement.FileMovement)
    if outstanding is True: q = q.filter(models.file_movement.FileMovement.return_date.is_(None))
    if outstanding is False: q = q.filter(models.file_movement.FileMovement.return_date.is_not(None))
    if file_no: q = q.filter(models.file_movement.FileMovement.file_no == file_no)
    q = q.order_by(models.file_movement.FileMovement.id.desc())
    return paginate(q, skip, limit).all()

def get(db: Session, movement_id: int):
    obj = db.get(models.file_movement.FileMovement, movement_id)
    if not obj: raise HTTPException(404, "Record not found")
    return obj
