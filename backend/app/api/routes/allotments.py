from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.schemas import allotment as s
from app.crud import allotment as crud

router = APIRouter(prefix="/allotments", tags=["allotments"])

@router.get("/", response_model=list[s.AllotmentOut])
def list_allotments(
    skip: int = 0,
    limit: int = 50,
    house_id: Optional[int] = None,
    active: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    return crud.list(db, skip, limit, house_id, active)

@router.post("/", response_model=s.AllotmentOut, status_code=201)
def create_allotment(payload: s.AllotmentCreate, db: Session = Depends(get_db)):
    return crud.create(db, payload)

@router.post("/{allotment_id}/end", response_model=s.AllotmentOut)
def end_allotment(
    allotment_id: int,
    notes: Optional[str] = None,
    vacation_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    return crud.end(db, allotment_id, notes, vacation_date)
