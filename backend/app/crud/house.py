from sqlalchemy.orm import Session
from sqlalchemy import select
from fastapi import HTTPException, status
from app import models
from app.schemas import house as s
from app.crud.utils import paginate
from app.models.house import House

def create(db: Session, obj_in: s.HouseCreate):
    exists = db.execute(
        select(House).where(House.file_no == obj_in.file_no)
    ).scalar_one_or_none()
    if exists:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File No already exists.")
    obj = House(**obj_in.dict())
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

def list(db: Session, skip: int = 0, limit: int = 50):
    q = db.query(House).order_by(House.id.desc())
    return paginate(q, skip, limit).all()

def get(db: Session, house_id: int):
    obj = db.get(House, house_id)
    if not obj:
        raise HTTPException(status_code=404, detail="House not found")
    return obj

def get_by_file_no(db: Session, file_no: str):
    obj = db.execute(
        select(models.House).where(models.House.file_no == file_no)
    ).scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="House with this File No not found")
    return obj

def update(db: Session, house_id: int, obj_in: s.HouseUpdate):
    obj = get(db, house_id)
    data = obj_in.dict(exclude_unset=True)
    if "file_no" in data and data["file_no"] != obj.file_no:
        clash = db.execute(
            select(models.House).where(models.House.file_no == data["file_no"])
        ).scalar_one_or_none()
        if clash:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File No already exists.")
    for k, v in data.items():
        setattr(obj, k, v)
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

def delete(db: Session, house_id: int):
    obj = get(db, house_id)
    db.delete(obj); db.commit()
    return {"ok": True}
