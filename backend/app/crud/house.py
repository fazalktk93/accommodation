from typing import Optional, List
from sqlalchemy import select, and_, or_, asc
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models import House
from app.schemas.house import HouseCreate, HouseUpdate

def get(db: Session, house_id: int) -> House:
    obj = db.get(House, house_id)
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="House not found")
    return obj

def get_by_file(db: Session, file_no: str) -> House:
    row = db.execute(select(House).where(House.file_no == file_no)).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="House not found")
    return row

def list(db: Session, skip=0, limit=50, q: Optional[str] = None,
         status: Optional[str] = None, type_code: Optional[str] = None) -> List[House]:
    stmt = select(House)
    conds = []
    if q:
        like = f"%{q}%"
        conds.append(or_(
            House.file_no.ilike(like),
            House.sector.ilike(like),
            House.street.ilike(like),
        ))
        if q.isdigit():
            conds.append(House.qtr_no == int(q))
    if status:
        conds.append(House.status == status.lower())
    if type_code:
        conds.append(House.type_code == type_code.upper())
    if conds:
        stmt = stmt.where(and_(*conds))
    stmt = stmt.order_by(asc(House.file_no), asc(House.id)).offset(skip).limit(limit)
    return db.execute(stmt).scalars().all()

def create(db: Session, obj_in: HouseCreate) -> House:
    exists = db.execute(select(House).where(House.file_no == obj_in.file_no)).scalar_one_or_none()
    if exists:
        return exists
    obj = House(**obj_in.dict())
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

def update(db: Session, house_id: int, obj_in: HouseUpdate) -> House:
    obj = get(db, house_id)
    data = obj_in.dict(exclude_unset=True)
    for k, v in data.items():
        setattr(obj, k, v)
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

def delete(db: Session, house_id: int) -> None:
    obj = get(db, house_id)
    db.delete(obj); db.commit()
