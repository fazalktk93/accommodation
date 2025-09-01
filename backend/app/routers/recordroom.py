# backend/app/routers/recordroom.py
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import select, func, desc, and_
from pydantic import BaseModel
from datetime import datetime

from ..deps import get_db, get_current_user, require_roles
from ..models.domain import FileMovement, House, RoleEnum, User

router = APIRouter(prefix="/recordroom", tags=["Record Room"])

# ---------- Schemas ----------
class MovementIn(BaseModel):
    house_id: Optional[int] = None
    file_number: str
    movement: str  # "issue" | "receive"
    to_whom: Optional[str] = None
    remarks: Optional[str] = None
    moved_at: Optional[datetime] = None

class MovementOut(BaseModel):
    id: int
    house_id: Optional[int]
    file_number: str
    movement: str
    to_whom: Optional[str]
    remarks: Optional[str]
    moved_at: datetime
    class Config:
        from_attributes = True

# ---------- CRUD ----------
@router.get("", response_model=List[MovementOut])
def list_movements(
    q: Optional[str] = Query(default=None, description="search by file number or to_whom"),
    file_number: Optional[str] = None,
    house_id: Optional[int] = None,
    page: int = 1,
    per_page: int = 20,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(FileMovement)
    if q:
        like = f"%{q}%"
        stmt = stmt.where((FileMovement.file_number.ilike(like)) | (FileMovement.to_whom.ilike(like)))
    if file_number:
        stmt = stmt.where(FileMovement.file_number == file_number)
    if house_id:
        stmt = stmt.where(FileMovement.house_id == house_id)
    stmt = stmt.order_by(FileMovement.moved_at.desc(), FileMovement.id.desc())
    rows = db.scalars(stmt.offset((page - 1) * per_page).limit(per_page)).all()
    return rows

@router.get("/{id}", response_model=MovementOut)
def get_movement(id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    mv = db.get(FileMovement, id)
    if not mv:
        raise HTTPException(404, "Movement not found")
    return mv

@router.post("", response_model=MovementOut)
def create_movement(payload: MovementIn, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleEnum.admin, RoleEnum.operator))):
    if payload.house_id and not db.get(House, payload.house_id):
        raise HTTPException(404, "House not found")
    if payload.movement not in ("issue", "receive"):
        raise HTTPException(400, "movement must be 'issue' or 'receive'")
    mv = FileMovement(
        house_id=payload.house_id,
        file_number=payload.file_number,
        movement=payload.movement,
        to_whom=payload.to_whom,
        remarks=payload.remarks,
        moved_at=payload.moved_at or datetime.utcnow(),
    )
    db.add(mv); db.commit(); db.refresh(mv)
    return mv

@router.put("/{id}", response_model=MovementOut)
def update_movement(id: int, payload: MovementIn, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleEnum.admin, RoleEnum.operator))):
    mv = db.get(FileMovement, id)
    if not mv:
        raise HTTPException(404, "Movement not found")
    if payload.house_id and not db.get(House, payload.house_id):
        raise HTTPException(404, "House not found")
    if payload.movement not in ("issue", "receive"):
        raise HTTPException(400, "movement must be 'issue' or 'receive'")
    mv.house_id = payload.house_id
    mv.file_number = payload.file_number
    mv.movement = payload.movement
    mv.to_whom = payload.to_whom
    mv.remarks = payload.remarks
    mv.moved_at = payload.moved_at or mv.moved_at
    db.add(mv); db.commit(); db.refresh(mv)
    return mv

@router.delete("/{id}")
def delete_movement(id: int, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleEnum.admin))):
    mv = db.get(FileMovement, id)
    if not mv:
        raise HTTPException(404, "Movement not found")
    db.delete(mv); db.commit()
    return {"ok": True}

# ---------- Convenience helpers ----------
class IssueReceiveIn(BaseModel):
    file_number: str
    to_whom: Optional[str] = None
    remarks: Optional[str] = None
    house_id: Optional[int] = None

@router.post("/issue", response_model=MovementOut)
def issue_file(payload: IssueReceiveIn, db: Session = Depends(get_db), user: User = Depends(require_roles(RoleEnum.admin, RoleEnum.operator))):
    mv = FileMovement(
        house_id=payload.house_id,
        file_number=payload.file_number,
        movement="issue",
        to_whom=payload.to_whom,
        remarks=payload.remarks,
        moved_by_user_id=user.id,
    )
    db.add(mv); db.commit(); db.refresh(mv)
    return mv

@router.post("/receive", response_model=MovementOut)
def receive_file(payload: IssueReceiveIn, db: Session = Depends(get_db), user: User = Depends(require_roles(RoleEnum.admin, RoleEnum.operator))):
    mv = FileMovement(
        house_id=payload.house_id,
        file_number=payload.file_number,
        movement="receive",
        to_whom=None,
        remarks=payload.remarks,
        moved_by_user_id=user.id,
    )
    db.add(mv); db.commit(); db.refresh(mv)
    return mv
