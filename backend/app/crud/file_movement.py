from typing import Optional, List
from datetime import date as dt_date
from sqlalchemy import select, and_, desc
from sqlmodel import Session
from fastapi import HTTPException, status
from app.models import FileMovement
from app.schemas.file_movement import FileMovementCreate, FileMovementUpdate

def get(db: Session, file_id: int) -> FileMovement:
    obj = db.get(FileMovement, file_id)
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File record not found")
    return obj

def list(db: Session, skip=0, limit=50, file_no: Optional[str] = None,
         outstanding: Optional[bool] = None) -> List[FileMovement]:
    stmt = select(FileMovement)
    conds = []
    if file_no:
        conds.append(FileMovement.file_no.ilike(f"%{file_no}%"))
    if outstanding is not None:
        if outstanding:
            conds.append(FileMovement.returned_date.is_(None))
        else:
            conds.append(FileMovement.returned_date.is_not(None))
    if conds:
        stmt = stmt.where(and_(*conds))
    stmt = stmt.order_by(desc(FileMovement.issue_date), desc(FileMovement.id)).offset(skip).limit(limit)
    return db.execute(stmt).scalars().all()

def create(db: Session, obj_in: FileMovementCreate) -> FileMovement:
    obj = FileMovement(**obj_in.dict())
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

def update(db: Session, file_id: int, obj_in: FileMovementUpdate) -> FileMovement:
    obj = get(db, file_id)
    data = obj_in.dict(exclude_unset=True)
    for k, v in data.items():
        setattr(obj, k, v)
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

def mark_returned(db: Session, file_id: int, returned_date: Optional[dt_date] = None) -> FileMovement:
    obj = get(db, file_id)
    obj.returned_date = returned_date or dt_date.today()
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

def delete(db: Session, file_id: int) -> None:
    obj = get(db, file_id)
    db.delete(obj); db.commit()
