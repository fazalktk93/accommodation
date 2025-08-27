from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from ..deps import get_db, require_roles
from ..models.domain import House, Colony, RoleEnum, User
from pydantic import BaseModel

router = APIRouter(prefix="/houses", tags=["Houses"])

class HouseIn(BaseModel):
    colony_id: int
    house_no: str
    house_type: str | None = None
    status: str = "available"

class HouseOut(HouseIn):
    id: int
    class Config:
        from_attributes = True

@router.post("", response_model=HouseOut)
def create_house(payload: HouseIn, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleEnum.admin, RoleEnum.operator))):
    if not db.get(Colony, payload.colony_id):
        raise HTTPException(404, "Colony not found")
    house = House(**payload.model_dump()); db.add(house); db.commit(); db.refresh(house)
    return house

@router.get("", response_model=list[HouseOut])
def list_houses(status: str | None = None, db: Session = Depends(get_db)):
    stmt = select(House)
    if status: stmt = stmt.where(House.status == status)
    return db.scalars(stmt.order_by(House.id.desc())).all()
# routers/houses.py (history)
@router.get("/{house_id}/history", response_model=list[OccupancyOut])
def history(house_id: int, db: Session = Depends(get_db)):
    return db.scalars(select(Occupancy).where(Occupancy.house_id==house_id).order_by(Occupancy.start_date.desc())).all()
