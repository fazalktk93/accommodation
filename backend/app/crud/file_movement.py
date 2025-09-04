from typing import Optional, List
from datetime import date as dt_date
from sqlalchemy import select, and_, desc
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models import FileMovement
from app.schemas.file_movement import FileMovementCreate, FileMovementUpdate

def get(db: Session, file_id: int) -> FileMovement:
    obj = db.get(FileMovement, file_id)
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File record not found")
    return obj

def list(
    db: Session,
    skip: int = 0,
    limit: int = 5000,
    file_no: Optional[str] = None,
    outstanding: Optional[bool] = None,
    missing: Optional[bool] = None,
) -> List[FileMovement]:
    """
    - outstanding=True  => returned_date IS NULL
    - outstanding=False => returned_date IS NOT NULL
    - missing=True      => returned_date IS NULL AND due_date < today
    Note: If both 'outstanding' and 'missing' are provided, 'missing' narrows it further.
    """
    stmt = select(FileMovement)
    conds = []
    today = dt_date.today()

    if file_no:
        conds.append(FileMovement.file_no.ilike(f"%{file_no}%"))
    if outstanding is True:
        conds.append(FileMovement.returned_date.is_(None))
    elif outstanding is False:
        conds.append(FileMovement.returned_date.is_not(None))
    if missing is True:
        conds.append(FileMovement.returned_date.is_(None))
        conds.append(FileMovement.due_date.is_not(None))
        conds.append(FileMovement.due_date < today)

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
