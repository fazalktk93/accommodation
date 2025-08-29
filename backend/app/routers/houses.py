# backend/app/routers/houses.py
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select
from pydantic import BaseModel

from ..deps import get_db, require_roles, get_current_user
from ..models.domain import (
    House,
    Occupancy,
    RoleEnum,
    User,
)
from ..schemas import OccupancyOut

router = APIRouter(prefix="/houses", tags=["Houses"])

ALLOWED_TYPES = {"A", "B", "C", "D", "E", "F", "G", "H"}


# -------------------- Pydantic Schemas --------------------
class HouseIn(BaseModel):
    # colony_id remains internal (UI can hide or default it)
    colony_id: int = 1
    quarter_no: str
    street: Optional[str] = None
    sector: Optional[str] = None
    type_letter: str  # A–H
    # This is the SAME value used by AccommodationFile.file_no
    file_number: Optional[str] = None


class HouseOut(BaseModel):
    id: int
    colony_id: int
    quarter_no: str
    street: Optional[str] = None
    sector: Optional[str] = None
    type_letter: str
    status: str
    # Echoes the active AccommodationFile.file_no (linked to this house)
    file_number: Optional[str] = None

    class Config:
        # works for pydantic v1 and v2
        orm_mode = True
        from_attributes = True


# -------------------- Helpers --------------------
def _active_file_for_house(db: Session, house_id: int) -> Optional[AccommodationFile]:
    """
    'Active' accommodation file = linked to this house and not closed.
    If multiple, return the most recently opened.
    """
    return db.scalar(
        select(AccommodationFile)
        .where(AccommodationFile.house_id == house_id, AccommodationFile.closed_at.is_(None))
        .order_by(AccommodationFile.opened_at.desc())
        .limit(1)
    )


def _to_out(db: Session, h: House) -> HouseOut:
    af = _active_file_for_house(db, h.id)
    return HouseOut(
        id=h.id,
        colony_id=h.colony_id,
        quarter_no=h.house_no,
        street=getattr(h, "street", None),
        sector=getattr(h, "sector", None),
        type_letter=h.house_type or "",
        status=h.status,
        file_number=(af.file_no if af else None),
    )


# -------------------- CRUD Endpoints --------------------
@router.post("", response_model=HouseOut)
def create_house(
    payload: HouseIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleEnum.admin, RoleEnum.operator)),
):
    qn = (payload.quarter_no or "").strip()
    if not qn:
        raise HTTPException(400, "Quarter No is required")

    t = (payload.type_letter or "").strip().upper()
    if t not in ALLOWED_TYPES:
        raise HTTPException(400, "Type must be one of A–H")

    # Uniqueness within colony
    exists = db.scalar(select(House).where(House.colony_id == payload.colony_id, House.house_no == qn))
    if exists:
        raise HTTPException(400, "A house with this Quarter No already exists in the selected colony")

    h = House(
        colony_id=payload.colony_id,
        house_no=qn,
        house_type=t,
        status="available",
    )
    # address fields are optional in DB; set only if present
    if hasattr(House, "street"):
        h.street = payload.street
    if hasattr(House, "sector"):
        h.sector = payload.sector

    db.add(h)
    db.commit()
    db.refresh(h)

    # Link / create accommodation file using the SAME file number
    if payload.file_number:
        fn = payload.file_number.strip()
        house = db.scalar(select(House).where(House.file_no == fn))
        if house:
            # prevent linking to a different house
            if house.id and house.id != h.id:
                raise HTTPException(409, "That accommodation file is already linked to another house")
            house.id = h.id
            db.add(house)
            db.commit()
        else:
            # auto-create accommodation file with this number, linked to the house
            file = AccommodationFile(file_no=fn, house_id=h.id)
            db.add(file)
            db.commit()

    return _to_out(db, h)


@router.get("", response_model=List[HouseOut])
def list_houses(
    status: Optional[str] = Query(default=None, description="Filter by status"),
    type_letter: Optional[str] = Query(default=None, description="Filter by Type A–H"),
    sector: Optional[str] = Query(default=None, description="Filter by sector"),
    file_number: Optional[str] = Query(default=None, description="Filter by accommodation file number"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(House)
    if status:
        stmt = stmt.where(House.status == status)
    if type_letter:
        stmt = stmt.where(House.house_type == type_letter)
    if sector and hasattr(House, "sector"):
        stmt = stmt.where(House.sector == sector)

    houses = db.scalars(stmt.order_by(House.id.desc())).all()

    # Optional filter by derived file_number
    if file_number:
        filtered: List[HouseOut] = []
        for h in houses:
            af = _active_file_for_house(db, h.id)
            if af and af.file_no == file_number:
                filtered.append(_to_out(db, h))
        return filtered

    return [_to_out(db, h) for h in houses]


@router.get("/{house_id}", response_model=HouseOut)
def get_house(
    house_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    h = db.get(House, house_id)
    if not h:
        raise HTTPException(404, "House not found")
    return _to_out(db, h)


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

    t = (payload.type_letter or "").strip().upper()
    if t not in ALLOWED_TYPES:
        raise HTTPException(400, "Type must be one of A–H")

    # uniqueness within colony
    conflict = db.scalar(
        select(House).where(House.id != house_id, House.colony_id == payload.colony_id, House.house_no == qn)
    )
    if conflict:
        raise HTTPException(400, "Another house with the same Quarter No exists in that colony")

    h.colony_id = payload.colony_id
    h.house_no = qn
    h.house_type = t
    if hasattr(House, "street"):
        h.street = payload.street
    if hasattr(House, "sector"):
        h.sector = payload.sector

    db.add(h)
    db.commit()

    # Handle file number relinking:
    # - payload.file_number == None  -> keep as-is
    # - payload.file_number == ""    -> unlink active file
    # - payload.file_number == "..." -> link existing or create new with that number
    if payload.file_number is not None:
        fn = payload.file_number.strip()
        if fn == "":
            af = _active_file_for_house(db, h.id)
            if af:
                af.house_id = None
                db.add(af)
                db.commit()
        else:
            file = db.scalar(select(AccommodationFile).where(AccommodationFile.file_no == fn))
            if file and file.house_id and file.house_id != h.id:
                raise HTTPException(409, "That accommodation file is already linked to another house")

            # unlink current active file if different
            af = _active_file_for_house(db, h.id)
            if af and (not file or af.id != file.id):
                af.house_id = None
                db.add(af)

            if not file:
                file = AccommodationFile(file_no=fn, house_id=h.id)
            else:
                file.house_id = h.id

            db.add(file)
            db.commit()

    db.refresh(h)
    return _to_out(db, h)


@router.delete("/{house_id}")
def delete_house(
    house_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleEnum.admin)),
):
    h = db.get(House, house_id)
    if not h:
        raise HTTPException(404, "House not found")

    # Optional safety: block delete if occupancy exists
    occ = db.scalar(select(Occupancy).where(Occupancy.house_id == house_id))
    if occ:
        raise HTTPException(400, "House has occupancy history; cannot delete")

    # Unlink any active accommodation file
    af = _active_file_for_house(db, house_id)
    if af:
        af.house_id = None
        db.add(af)

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
