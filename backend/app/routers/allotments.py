# backend/app/routers/allotments.py
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime

from ..deps import get_db, require_roles, get_current_user
from ..models.domain import Allotment, WaitingList, House, Application, ApplicationStatus, RoleEnum, User
from pydantic import BaseModel

router = APIRouter(prefix="/allotments", tags=["Allotments"])

class AllotmentOut(BaseModel):
    id: int
    application_id: int
    house_id: int
    allotted_at: datetime
    class Config:
        from_attributes = True

@router.get("", response_model=List[AllotmentOut])
def list_allotments(
    employee_id: Optional[int] = None,
    house_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(Allotment)
    if employee_id:
        stmt = stmt.join(Allotment.application).where(Application.employee_id == employee_id)
    if house_id:
        stmt = stmt.where(Allotment.house_id == house_id)
    stmt = stmt.order_by(Allotment.allotted_at.desc(), Allotment.id.desc())
    return db.scalars(stmt).all()

@router.get("/{allotment_id}", response_model=AllotmentOut)
def get_allotment(allotment_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    row = db.get(Allotment, allotment_id)
    if not row:
        raise HTTPException(404, "Allotment not found")
    return row

@router.post("/assign/{waiting_id}", response_model=AllotmentOut)
def assign_house(waiting_id: int, house_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleEnum.admin))):
    wl = db.get(WaitingList, waiting_id)
    if not wl:
        raise HTTPException(404, "Waiting entry not found")
    house = db.get(House, house_id)
    if not house or house.status != "available":
        raise HTTPException(400, "House not available")
    allot = Allotment(application_id=wl.application_id, house_id=house_id, allotted_at=datetime.utcnow())
    app = db.get(Application, wl.application_id)
    app.status = ApplicationStatus.allotted
    house.status = "occupied"
    db.add(allot); db.delete(wl); db.commit(); db.refresh(allot)
    return allot

@router.post("/release/{allotment_id}")
def release_house(allotment_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleEnum.admin))):
    allot = db.get(Allotment, allotment_id)
    if not allot:
        raise HTTPException(404, "Allotment not found")
    house = db.get(House, allot.house_id)
    app = db.get(Application, allot.application_id)
    app.status = ApplicationStatus.approved  # back to approved so it can re-enter WL if desired
    house.status = "available"
    db.delete(allot); db.commit()
    return {"ok": True}
