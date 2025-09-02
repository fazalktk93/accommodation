from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.schemas import file_movement as s
from app.crud import file_movement as crud
from app.crud import house as house_crud

router = APIRouter(prefix="/files", tags=["file-movement"])

@router.get("/", response_model=list[s.FileMovementOut])
def list_movements(
    skip: int = 0,
    limit: int = 50,
    outstanding: Optional[bool] = None,
    file_no: Optional[str] = None,
    db: Session = Depends(get_db),
):
    return crud.list(db, skip, limit, outstanding, file_no)

@router.post("/issue", response_model=s.FileMovementOut, status_code=201)
def issue_file(payload: s.FileIssueCreate, db: Session = Depends(get_db)):
    return crud.issue(db, payload)

@router.post("/{movement_id}/return", response_model=s.FileMovementOut)
def return_file(movement_id: int, payload: s.FileReturn = s.FileReturn(), db: Session = Depends(get_db)):
    return crud.return_file(db, movement_id, remarks=payload.remarks)

@router.get("/status/{file_no}", response_model=s.FileStatus)
def status(file_no: str, db: Session = Depends(get_db)):
    house = house_crud.get_by_file_no(db, file_no)
    # find outstanding movement if any
    from sqlalchemy import and_, select
    fm = db.execute(
        select(s.FileMovementModel).where(  # type: ignore[attr-defined]
            and_(s.FileMovementModel.house_id == house.id,
                 s.FileMovementModel.return_date.is_(None))
    )).scalar_one_or_none()
    if fm:
        return s.FileStatus(file_no=file_no, status="issued", issued_to=fm.issued_to, subject=fm.subject)
    return s.FileStatus(file_no=file_no, status="available")
