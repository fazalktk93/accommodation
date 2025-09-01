from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app import schemas
from app.crud import allotment as crud

router = APIRouter(prefix="/allotments", tags=["allotments"])

@router.post("/", response_model=schemas.allotment.Allotment, status_code=201)
def create(payload: schemas.allotment.AllotmentCreate, db: Session = Depends(get_db)):
    return crud.create(db, payload)

@router.post("/{allotment_id}/end", response_model=schemas.allotment.Allotment)
def end(allotment_id: int, notes: str | None = None, db: Session = Depends(get_db)):
    return crud.end(db, allotment_id, notes)

@router.get("/", response_model=List[schemas.allotment.Allotment])
def list_(skip: int = 0, limit: int = 50, house_id: int | None = None, active: bool | None = None, db: Session = Depends(get_db)):
    return crud.list(db, skip, limit, house_id, active)

@router.get("/{allotment_id}", response_model=schemas.allotment.Allotment)
def get(allotment_id: int, db: Session = Depends(get_db)):
    return crud.get(db, allotment_id)
