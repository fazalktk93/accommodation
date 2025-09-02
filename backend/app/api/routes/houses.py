from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.schemas import house as s
from app.crud import house as crud

router = APIRouter(prefix="/houses", tags=["houses"])

@router.get("/", response_model=list[s.HouseOut])
def list_(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    return crud.list(db, skip, limit)

@router.post("/", response_model=s.HouseOut, status_code=201)
def create_(payload: s.HouseCreate, db: Session = Depends(get_db)):
    return crud.create(db, payload)

@router.patch("/{house_id}", response_model=s.HouseOut)
def update_(house_id: int, payload: s.HouseUpdate, db: Session = Depends(get_db)):
    return crud.update(db, house_id, payload)

@router.delete("/{house_id}")
def delete_(house_id: int, db: Session = Depends(get_db)):
    return crud.delete(db, house_id)
