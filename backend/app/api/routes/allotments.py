from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..deps import get_db
from schemas import allotment as s
from ...crud import allotment as crud

router = APIRouter(prefix="/allotments", tags=["allotments"])

@router.post("/", response_model=s.Allotment, status_code=201)
def create_allotment(payload: s.AllotmentCreate, db: Session = Depends(get_db)):
    return crud.create(db, payload)

@router.patch("/{allotment_id}", response_model=s.Allotment)
def update_allotment(allotment_id: int, payload: s.AllotmentUpdate, db: Session = Depends(get_db)):
    return crud.update(db, allotment_id, payload)

@router.post("/{allotment_id}/end", response_model=s.Allotment)
def end_allotment(allotment_id: int, notes: Optional[str] = None, vacation_date: Optional[date] = None, db: Session = Depends(get_db)):
    return crud.end(db, allotment_id, notes, vacation_date)

@router.get("/", response_model=List[s.Allotment])
def list_allotments(skip: int = 0, limit: int = 50, house_id: int = None, active: bool = None, db: Session = Depends(get_db)):
    return crud.list(db, skip, limit, house_id, active)

@router.get("/{allotment_id}", response_model=s.Allotment)
def get_allotment(allotment_id: int, db: Session = Depends(get_db)):
    return crud.get(db, allotment_id)
