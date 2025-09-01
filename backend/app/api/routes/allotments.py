from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..deps import get_db
from ...schemas import allotment as allotment_schema
from ...crud import allotment as crud_allotment

router = APIRouter(prefix="/allotments", tags=["allotments"])

@router.post("/", response_model=allotment_schema.Allotment, status_code=201)
def create_allotment(payload: allotment_schema.AllotmentCreate, db: Session = Depends(get_db)):
    return crud_allotment.create(db, payload)

@router.post("/{allotment_id}/end", response_model=allotment_schema.Allotment)
def end_allotment(allotment_id: int, notes: str | None = None, db: Session = Depends(get_db)):
    return crud_allotment.end(db, allotment_id, notes)

@router.get("/", response_model=List[allotment_schema.Allotment])
def list_allotments(skip: int = 0, limit: int = 50, house_id: int | None = None, active: bool | None = None, db: Session = Depends(get_db)):
    return crud_allotment.list(db, skip, limit, house_id, active)

@router.get("/{allotment_id}", response_model=allotment_schema.Allotment)
def get_allotment(allotment_id: int, db: Session = Depends(get_db)):
    return crud_allotment.get(db, allotment_id)
