from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.api.deps import get_db
from app.schemas import house as house_schema
from app.crud import house as crud

router = APIRouter(prefix="/houses", tags=["houses"])

@router.post("/", response_model=schemas.house.House, status_code=201)
def create(payload: schemas.house.HouseCreate, db: Session = Depends(get_db)):
    return crud.create(db, payload)

@router.get("/", response_model=List[schemas.house.House])
def list_(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    return crud.list(db, skip, limit)

@router.get("/{house_id}", response_model=schemas.house.House)
def get(house_id: int, db: Session = Depends(get_db)):
    return crud.get(db, house_id)

@router.patch("/{house_id}", response_model=schemas.house.House)
def update(house_id: int, payload: schemas.house.HouseUpdate, db: Session = Depends(get_db)):
    return crud.update(db, house_id, payload)

@router.delete("/{house_id}")
def delete(house_id: int, db: Session = Depends(get_db)):
    return crud.delete(db, house_id)
