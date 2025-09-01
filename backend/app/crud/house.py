from sqlalchemy.orm import Session
from sqlalchemy import select
from fastapi import HTTPException, status
from app import models, schemas
from app.crud.utils import paginate

def create(db: Session, obj_in: schemas.house.HouseCreate):
    exists = db.execute(select(models.house.House).where(models.house.House.name == obj_in.name)).scalar_one_or_none()
    if exists:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="House with this name already exists.")
    obj = models.house.House(**obj_in.dict())
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

def get(db: Session, house_id: int):
    obj = db.get(models.house.House, house_id)
    if not obj: raise HTTPException(404, "House not found")
    return obj

def list(db: Session, skip: int = 0, limit: int = 50):
    q = db.query(models.house.House).order_by(models.house.House.id.desc())
    return paginate(q, skip, limit).all()

def update(db: Session, house_id: int, obj_in: schemas.house.HouseUpdate):
    obj = get(db, house_id)
    for k, v in obj_in.dict(exclude_unset=True).items():
        setattr(obj, k, v)
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

def delete(db: Session, house_id: int):
    obj = get(db, house_id)
    db.delete(obj); db.commit()
    return {"ok": True}
