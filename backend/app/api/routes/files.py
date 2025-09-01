from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..deps import get_db
from ...schemas import file_movement as fm_schema
from ...crud import file_movement as crud_fm

router = APIRouter(prefix="/files", tags=["file-movements"])

@router.post("/issue", response_model=fm_schema.FileMovement, status_code=201)
def issue_file(payload: fm_schema.FileIssueCreate, db: Session = Depends(get_db)):
    return crud_fm.issue(db, payload)

@router.post("/{movement_id}/return", response_model=fm_schema.FileMovement)
def return_file(movement_id: int, payload: fm_schema.FileReturnUpdate | None = None, db: Session = Depends(get_db)):
    remarks = payload.remarks if payload else None
    return crud_fm.return_file(db, movement_id, remarks)

@router.get("/", response_model=List[fm_schema.FileMovement])
def list_movements(skip: int = 0, limit: int = 50, outstanding: bool | None = None, file_code: str | None = None, db: Session = Depends(get_db)):
    return crud_fm.list(db, skip, limit, outstanding, file_code)

@router.get("/{movement_id}", response_model=fm_schema.FileMovement)
def get_movement(movement_id: int, db: Session = Depends(get_db)):
    return crud_fm.get(db, movement_id)
