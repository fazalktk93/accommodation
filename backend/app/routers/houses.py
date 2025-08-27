# backend/app/routers/houses.py
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from ..deps import get_db, require_roles
from ..models.domain import House, Colony, RoleEnum, User, Occupancy  # ← include Occupancy model
from ..schemas import OccupancyOut                                   # ← import ONLY this
from pydantic import BaseModel

router = APIRouter(prefix="/houses", tags=["Houses"])

# ---- Local Pydantic schemas for this router ----
class HouseIn(BaseModel):
    colony_id: int
    house_no: str
    house_type: Optional[str] = None
    status: str = "available"

class HouseOut(BaseModel):
    id: int
    colony_id: int
    house_no: str
    house_type: Optional[str] = None
    status: str
    class Config:
        from_attributes = True

# ---- Endpoints ----
@router.post("", response_model=HouseOut)
def create_house(
    payload: HouseIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleEnum.admin, RoleEnum.operator)),
):
    if not db.get(Colony, payload.colony_id):
        raise HTTPException(404, "Colony not found")
    house = House(**payload.model_dump())
    db.add(house)
    db.commit()
    db.refresh(house)
    return house

@router.get("", response_model=list[HouseOut])
def list_houses(status: Optional[str] = None, db: Session = Depends(get_db)):
    stmt = select(House)
    if status:
        stmt = stmt.where(House.status == status)
    return db.scalars(stmt.order_by(House.id.desc())).all()

@router.get("/{house_id}/history", response_model=list[OccupancyOut])
def history(house_id: int, db: Session = Depends(get_db)):
    return db.scalars(
        select(Occupancy)
        .where(Occupancy.house_id == house_id)
        .order_by(Occupancy.start_date.desc())
    ).all()
