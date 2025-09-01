# backend/app/routers/gwl.py
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime

from ..deps import get_db, require_roles, get_current_user
from ..models.domain import WaitingList, Application, RoleEnum, User
from pydantic import BaseModel

router = APIRouter(prefix="/gwl", tags=["General Waiting List"])

class GwlIn(BaseModel):
    application_id: int
    priority: int

class GwlOut(BaseModel):
    id: int
    application_id: int
    priority: int
    created_at: datetime
    class Config:
        from_attributes = True

@router.get("", response_model=List[GwlOut])
def list_wl(
    status: Optional[str] = Query(default=None, description="(reserved for future)"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(WaitingList).order_by(WaitingList.priority.asc(), WaitingList.created_at.asc())
    return db.scalars(stmt).all()

@router.get("/{wl_id}", response_model=GwlOut)
def get_wl(wl_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    row = db.get(WaitingList, wl_id)
    if not row:
        raise HTTPException(404, "Waiting list entry not found")
    return row

@router.post("", response_model=GwlOut)
def create_wl(payload: GwlIn, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleEnum.admin, RoleEnum.operator))):
    if not db.get(Application, payload.application_id):
        raise HTTPException(404, "Application not found")
    if db.scalar(select(WaitingList).where(WaitingList.application_id == payload.application_id)):
        raise HTTPException(400, "Application already on waiting list")

    row = WaitingList(application_id=payload.application_id, priority=payload.priority)
    db.add(row); db.commit(); db.refresh(row)
    return row

@router.put("/{wl_id}", response_model=GwlOut)
def update_wl(wl_id: int, payload: GwlIn, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleEnum.admin, RoleEnum.operator))):
    row = db.get(WaitingList, wl_id)
    if not row:
        raise HTTPException(404, "Waiting list entry not found")
    if payload.application_id != row.application_id:
        if not db.get(Application, payload.application_id):
            raise HTTPException(404, "New application not found")
        if db.scalar(select(WaitingList).where(WaitingList.application_id == payload.application_id)):
            raise HTTPException(400, "New application already on waiting list")
        row.application_id = payload.application_id
    row.priority = payload.priority
    db.add(row); db.commit(); db.refresh(row)
    return row

@router.delete("/{wl_id}")
def delete_wl(wl_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleEnum.admin))):
    row = db.get(WaitingList, wl_id)
    if not row:
        raise HTTPException(404, "Waiting list entry not found")
    db.delete(row); db.commit()
    return {"ok": True}
