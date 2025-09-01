from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..deps import get_db
from app.schemas import file_movement as s
from ...crud import file_movement as crud

router = APIRouter(prefix="/files", tags=["file-movements"])

@router.post("/issue", response_model=s.FileMovement, status_code=201)
def issue(payload: s.FileIssueCreate, db: Session = Depends(get_db)):
    return crud.issue(db, payload)

@router.post("/{movement_id}/return", response_model=s.FileMovement)
def return_(movement_id: int, payload: s.FileReturnUpdate = None, db: Session = Depends(get_db)):
    remarks = payload.remarks if payload else None
    return crud.return_file(db, movement_id, remarks)

@router.get("/", response_model=List[s.FileMovement])
def list_(skip: int = 0, limit: int = 50, outstanding: bool = None, file_no: str = None, db: Session = Depends(get_db)):
    return crud.list(db, skip, limit, outstanding, file_no)

@router.get("/{movement_id}", response_model=s.FileMovement)
def get(movement_id: int, db: Session = Depends(get_db)):
    return crud.get(db, movement_id)
