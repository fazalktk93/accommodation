from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.house import House
from app.schemas.house import HouseCreate, HouseUpdate

def _file_col():
    for n in ("file_no", "file", "file_number", "fileno"):
        if hasattr(House, n):
            return getattr(House, n)
    return None

def create(db: Session, obj_in: HouseCreate) -> House:
    fcol = _file_col()
    if fcol is None:
        # No file column in model: create as-is
        obj = House(**obj_in.dict())
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj

    # enforce uniqueness by whatever your schema calls file_no
    exists = db.execute(select(House).where(fcol == obj_in.file_no)).scalar_one_or_none()
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
