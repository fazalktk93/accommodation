# backend/app/routers/houses.py
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select
from pydantic import BaseModel

from ..deps import get_db, require_roles, get_current_user
from ..models.domain import House, Occupancy, RoleEnum, User
from ..schemas import OccupancyOut

router = APIRouter(prefix="/houses", tags=["Houses"])

ALLOWED_TYPES = {"A","B","C","D","E","F","G","H"}

# ---- Pydantic schemas ----
class HouseIn(BaseModel):
    # colony_id stays in the payload for now; UI won’t expose it
    colony_id: int = 1
    quarter_no: str
    street: Optional[str] = None
    sector: Optional[str] = None
    type_letter: str  # A–H
    file_number: Optional[str] = None

class HouseOut(BaseModel):
    id: int
    colony_id: int
    quarter_no: str
    street: Optional[str] = None
    sector: Optional[str] = None
    type_letter: str
    status: str
    file_number: Optional[str] = None

    class Config:
        orm_mode = True
        from_attributes = True

def _to_out(h: House) -> HouseOut:
    return HouseOut(
        id=h.id,
        colony_id=h.colony_id,
        quarter_no=h.house_no,
        street=getattr(h, "street", None),
        sector=getattr(h, "sector", None),
        type_letter=h.house_type or "",
        status=h.status,
        file_number=getattr(h, "file_number", None),
    )

# ---- CRUD endpoints ----
@router.post("", response_model=HouseOut)
def create_house(
    payload: HouseIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleEnum.admin, RoleEnum.operator)),
):
    qn = (payload.quarter_no or "").strip()
    if not qn:
        raise HTTPException(400, "Quarter No is required")
    if payload.type_letter not in ALLOWED_TYPES:
        raise HTTPException(400, "Type must be one of A, B, C, D, E, F, G, H")

    # unique per (colony_id, house_no)
    exists = db.scalar(
        select(House).where(House.colony_id == payload.colony_id, House.house_no == qn)
    )
    if exists:
        raise HTTPException(400, "A house with this Quarter No already exists in the selected colony")

    row = House(
        colony_id=payload.colony_id,
        house_no=qn,
        house_type=payload.type_letter,
        street=payload.street,
        sector=payload.sector,
        status="available",
    )

    # set file number only if the column exists (safe during rollout)
    if hasattr(House, "file_number"):
        row.file_number = payload.file_number

    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_out(row)

@router.get("", response_model=List[HouseOut])
def list_houses(
    status: Optional[str] = Query(default=None, description="Filter by status"),
    type_letter: Optional[str] = Query(default=None, description="Filter by Type A-H"),
    sector: Optional[str] = Query(default=None, description="Filter by sector"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(House)
    if status:
        stmt = stmt.where(House.status == status)
    if type_letter:
        stmt = stmt.where(House.house_type == type_letter)
    if sector:
        stmt = stmt.where(House.sector == sector)
    items = db.scalars(stmt.order_by(House.id.desc())).all()
    return [_to_out(h) for h in items]

@router.get("/{house_id}", response_model=HouseOut)
def get_house(
    house_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    h = db.get(House, house_id)
    if not h:
        raise HTTPException(404, "House not found")
    return _to_out(h)

@router.put("/{house_id}", response_model=HouseOut)
def update_house(
    house_id: int,
    payload: HouseIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleEnum.admin, RoleEnum.operator)),
):
    h = db.get(House, house_id)
    if not h:
        raise HTTPException(404, "House not found")

    qn = (payload.quarter_no or "").strip()
    if not qn:
        raise HTTPException(400, "Quarter No is required")
    if payload.type_letter not in ALLOWED_TYPES:
        raise HTTPException(400, "Type must be one of A, B, C, D, E, F, G, H")

    # conflict check for (colony_id, house_no)
    conflict = db.scalar(
        select(House).where(
            House.id != house_id,
            House.colony_id == payload.colony_id,
            House.house_no == qn,
        )
    )
    if conflict:
        raise HTTPException(400, "Another house with the same Quarter No exists in that colony")

    h.colony_id = payload.colony_id
    h.house_no = qn
    h.house_type = payload.type_letter
    h.street = payload.street
    h.sector = payload.sector
    if hasattr(House, "file_number"):
        h.file_number = payload.file_number

    db.add(h)
    db.commit()
    db.refresh(h)
    return _to_out(h)

@router.delete("/{house_id}")
def delete_house(
    house_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleEnum.admin)),
):
    h = db.get(House, house_id)
    if not h:
        raise HTTPException(404, "House not found")

    occ = db.scalar(select(Occupancy).where(Occupancy.house_id == house_id))
    if occ:
        raise HTTPException(400, "House has occupancy history; cannot delete")

    db.delete(h)
    db.commit()
    return {"ok": True}

@router.get("/{house_id}/history", response_model=List[OccupancyOut])
def history(
    house_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    rows = db.scalars(
        select(Occupancy)
        .where(Occupancy.house_id == house_id)
        .order_by(Occupancy.start_date.desc())
    ).all()
    return rows
