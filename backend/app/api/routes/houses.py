from typing import Optional, List
from fastapi import APIRouter, Depends
from sqlmodel import Session
from app.api.deps import get_db
from app.schemas import house as s
from app.crud import house as crud

router = APIRouter(prefix="/houses", tags=["houses"])

@router.get("/", response_model=List[s.HouseOut])
def list_houses(skip: int = 0, limit: int = 50, q: Optional[str] = None,
                status: Optional[str] = None, type_code: Optional[str] = None,
                db: Session = Depends(get_db)):
    return crud.list(db, skip=skip, limit=limit, q=q, status=status, type_code=type_code)

@router.get("/{house_id}", response_model=s.HouseOut)
def get_house(house_id: int, db: Session = Depends(get_db)):
    return crud.get(db, house_id)

@router.get("/by-file/{file_no}", response_model=s.HouseOut)
def get_by_file(file_no: str, db: Session = Depends(get_db)):
    return crud.get_by_file(db, file_no)

@router.post("/", response_model=s.HouseOut, status_code=201)
def create_house(payload: s.HouseCreate, db: Session = Depends(get_db)):
    return crud.create(db, payload)

@router.patch("/{house_id}", response_model=s.HouseOut)
def update_house(house_id: int, payload: s.HouseUpdate, db: Session = Depends(get_db)):
    return crud.update(db, house_id, payload)

@router.delete("/{house_id}", status_code=204)
def delete_house(house_id: int, db: Session = Depends(get_db)):
    crud.delete(db, house_id)
    return None
