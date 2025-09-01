from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from ..deps import get_db
from ...schemas import house as house_schema
from ...crud import house as crud_house

router = APIRouter(prefix="/houses", tags=["houses"])

@router.post("/", response_model=house_schema.House, status_code=201)
def create_house(payload: house_schema.HouseCreate, db: Session = Depends(get_db)):
    return crud_house.create(db, payload)

@router.get("/", response_model=List[house_schema.House])
def list_houses(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    return crud_house.list(db, skip, limit)

@router.get("/{house_id}", response_model=house_schema.House)
def get_house(house_id: int, db: Session = Depends(get_db)):
    return crud_house.get(db, house_id)

@router.patch("/{house_id}", response_model=house_schema.House)
def update_house(house_id: int, payload: house_schema.HouseUpdate, db: Session = Depends(get_db)):
    return crud_house.update(db, house_id, payload)

@router.delete("/{house_id}")
def delete_house(house_id: int, db: Session = Depends(get_db)):
    return crud_house.delete(db, house_id)
