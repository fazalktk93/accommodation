# backend/app/routers/record_room.py
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, text
from pydantic import BaseModel

from ..deps import get_db, require_roles, get_current_user
from ..models.domain import FileMovement, RoleEnum, User, House

router = APIRouter(prefix="/recordroom", tags=["Record Room"])

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

def _house_by_file(db: Session, file_number: str) -> Optional[House]:
    if not file_number:
        return None
    return db.scalar(select(House).where(House.file_no == file_number))

@router.post("/issue", response_model=MovementOut)
def issue_file(
    payload: MovementIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(RoleEnum.admin, RoleEnum.operator)),
):
    h = _house_by_file(db, payload.file_number)
    mv = FileMovement(
        house_id=h.id if h else None,
        file_number=payload.file_number,
        movement="issue",
        to_whom=payload.to_whom,
        remarks=payload.remarks,
        moved_by_user_id=user.id,
    )
    db.add(mv); db.commit(); db.refresh(mv)
    return MovementOut(
        id=mv.id, file_number=mv.file_number, movement=mv.movement,
        moved_at=mv.moved_at.isoformat(), to_whom=mv.to_whom, remarks=mv.remarks
    )

@router.post("/receive", response_model=MovementOut)
def receive_file(
    payload: MovementIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(RoleEnum.admin, RoleEnum.operator)),
):
    h = _house_by_file(db, payload.file_number)
    mv = FileMovement(
        house_id=h.id if h else None,
        file_number=payload.file_number,
        movement="receive",
        to_whom=payload.to_whom,
        remarks=payload.remarks,
        moved_by_user_id=user.id,
    )
    db.add(mv); db.commit(); db.refresh(mv)
    return MovementOut(
        id=mv.id, file_number=mv.file_number, movement=mv.movement,
        moved_at=mv.moved_at.isoformat(), to_whom=mv.to_whom, remarks=mv.remarks
    )

@router.get("/movements", response_model=List[MovementOut])
def list_movements(
    file_number: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(FileMovement).order_by(FileMovement.moved_at.desc())
    rows = db.scalars(stmt).all()

    out: List[MovementOut] = []
    for mv in rows:
        if file_number and mv.file_number != file_number:
            continue
        out.append(MovementOut(
            id=mv.id,
            file_number=mv.file_number,
            movement=mv.movement,
            moved_at=mv.moved_at.isoformat(),
            to_whom=mv.to_whom,
            remarks=mv.remarks,
        ))
    return out
