from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from fastapi import HTTPException, status
from typing import Optional
from app import models
from app.schemas import file_movement as s
from app.crud import house as house_crud
from app.crud.utils import paginate
from datetime import datetime, timezone

def issue(db: Session, obj_in: s.FileIssueCreate):
    house_id = obj_in.house_id
    if not house_id and obj_in.file_no:
        house_id = house_crud.get_by_file_no(db, obj_in.file_no).id
    if not house_id:
        raise HTTPException(status_code=400, detail="house_id or valid file_no is required")

    existing = db.execute(
        select(models.FileMovement).where(
            and_(
                models.FileMovement.house_id == house_id,
                models.FileMovement.return_date.is_(None),
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="File already issued and not yet returned.")

    house = db.get(models.House, house_id)
    if not house:
        raise HTTPException(status_code=404, detail="House not found")

    obj = models.FileMovement(
        house_id=house_id,
        file_no=house.file_no,
        subject=obj_in.subject,
        issued_to=obj_in.issued_to,
        department=obj_in.department,
        due_date=obj_in.due_date,
        remarks=obj_in.remarks,
    )
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

def return_file(db: Session, movement_id: int, remarks: Optional[str] = None):
    obj = db.get(models.FileMovement, movement_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Record not found")
    if obj.return_date is not None:
        raise HTTPException(status_code=400, detail="Already returned")
    obj.return_date = datetime.now(tz=timezone.utc)
    if remarks:
        obj.remarks = (obj.remarks + "\n" if obj.remarks else "") + remarks
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

def list(db: Session, skip: int = 0, limit: int = 50, outstanding: Optional[bool] = None, file_no: Optional[str] = None):
    q = db.query(models.FileMovement)
    if outstanding is True: q = q.filter(models.FileMovement.return_date.is_(None))
    if outstanding is False: q = q.filter(models.FileMovement.return_date.is_not(None))
    if file_no: q = q.filter(models.FileMovement.file_no == file_no)
    q = q.order_by(models.FileMovement.id.desc())
    return paginate(q, skip, limit).all()

def get(db: Session, movement_id: int):
    obj = db.get(models.FileMovement, movement_id)
    if not obj: raise HTTPException(404, "Record not found")
    return obj
