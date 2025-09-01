from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app import schemas
from app.crud import file_movement as crud

router = APIRouter(prefix="/files", tags=["file-movements"])

@router.post("/issue", response_model=schemas.file_movement.FileMovement, status_code=201)
def issue(payload: schemas.file_movement.FileIssueCreate, db: Session = Depends(get_db)):
    return crud.issue(db, payload)

@router.post("/{movement_id}/return", response_model=schemas.file_movement.FileMovement)
def return_(movement_id: int, payload: schemas.file_movement.FileReturnUpdate | None = None, db: Session = Depends(get_db)):
    remarks = payload.remarks if payload else None
    return crud.return_file(db, movement_id, remarks)

@router.get("/", response_model=List[schemas.file_movement.FileMovement])
def list_(skip: int = 0, limit: int = 50, outstanding: bool | None = None, file_code: str | None = None, db: Session = Depends(get_db)):
    return crud.list(db, skip, limit, outstanding, file_code)

@router.get("/{movement_id}", response_model=schemas.file_movement.FileMovement)
def get(movement_id: int, db: Session = Depends(get_db)):
    return crud.get(db, movement_id)
