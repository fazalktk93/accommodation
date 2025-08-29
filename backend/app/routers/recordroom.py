# backend/app/routers/record_room.py
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from pydantic import BaseModel

from ..deps import get_db, require_roles, get_current_user
from ..models.domain import AccommodationFile, FileMovement, RoleEnum, User

router = APIRouter(prefix="/record-room", tags=["Record Room"])

class MovementIn(BaseModel):
    file_number: str
    to_whom: Optional[str] = None
    remarks: Optional[str] = None

class MovementOut(BaseModel):
    id: int
    file_number: str
    movement: str
    moved_at: str
    to_whom: Optional[str] = None
    remarks: Optional[str] = None

@router.post("/issue", response_model=MovementOut)
def issue_file(payload: MovementIn, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleEnum.admin, RoleEnum.operator))):
    file = db.scalar(select(AccommodationFile).where(AccommodationFile.file_no == payload.file_number))
    if not file:
        raise HTTPException(404, "Accommodation file not found")
    mv = FileMovement(
        accommodation_file_id=file.id,
        movement="issue",
        to_whom=payload.to_whom,
        remarks=payload.remarks,
    )
    db.add(mv); db.commit(); db.refresh(mv)
    return MovementOut(
        id=mv.id, file_number=file.file_no, movement=mv.movement,
        moved_at=mv.moved_at.isoformat(), to_whom=mv.to_whom, remarks=mv.remarks
    )

@router.post("/receive", response_model=MovementOut)
def receive_file(payload: MovementIn, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleEnum.admin, RoleEnum.operator))):
    file = db.scalar(select(AccommodationFile).where(AccommodationFile.file_no == payload.file_number))
    if not file:
        raise HTTPException(404, "Accommodation file not found")
    mv = FileMovement(
        accommodation_file_id=file.id,
        movement="receive",
        to_whom=payload.to_whom,
        remarks=payload.remarks,
    )
    db.add(mv); db.commit(); db.refresh(mv)
    return MovementOut(
        id=mv.id, file_number=file.file_no, movement=mv.movement,
        moved_at=mv.moved_at.isoformat(), to_whom=mv.to_whom, remarks=mv.remarks
    )

@router.get("/movements", response_model=List[MovementOut])
def list_movements(file_number: Optional[str] = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    stmt = select(FileMovement).order_by(FileMovement.moved_at.desc())
    rows = db.scalars(stmt).all()
    out: List[MovementOut] = []
    for mv in rows:
        f = db.get(AccommodationFile, mv.accommodation_file_id)
        if not f:
            continue
        if file_number and f.file_no != file_number:
            continue
        out.append(MovementOut(
            id=mv.id, file_number=f.file_no, movement=mv.movement,
            moved_at=mv.moved_at.isoformat(), to_whom=mv.to_whom, remarks=mv.remarks
        ))
    return out
