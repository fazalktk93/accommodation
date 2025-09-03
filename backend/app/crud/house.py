from sqlalchemy import select
from sqlmodel import Session
from app.models import House
from app.schemas.house import HouseCreate, HouseUpdate

def create(db: Session, obj_in: HouseCreate) -> House:
    # uniqueness by file_no
    exists = db.execute(select(House).where(House.file_no == obj_in.file_no)).scalar_one_or_none()
    if exists:
        return exists
    obj = House(**obj_in.dict())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

def update(db: Session, house_id: int, obj_in: HouseUpdate) -> House:
    obj = db.get(House, house_id)
    if not obj:
        raise ValueError("House not found")
    data = obj_in.dict(exclude_unset=True)
    for k, v in data.items():
        setattr(obj, k, v)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

def delete(db: Session, house_id: int) -> None:
    obj = db.get(House, house_id)
    if not obj:
        return
    db.delete(obj)
    db.commit()
