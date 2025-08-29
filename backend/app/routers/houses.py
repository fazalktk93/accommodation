# backend/app/routers/houses.py
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, MetaData, Table, func

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
from pydantic import BaseModel


class HouseIn(BaseModel):
    colony_id: int = 1
    quarter_no: str
    street: Optional[str] = None
    sector: Optional[str] = None
    type_letter: str  # A–H
    # SAME value we mirror to accommodation_files.file_no
    file_number: Optional[str] = None


class HouseOut(BaseModel):
    id: int
    colony_id: int
    quarter_no: str
    street: Optional[str] = None
    sector: Optional[str] = None
    type_letter: str
    status: str
    # Echoes houses.file_number (and we also mirror to accommodation_files.file_no)
    file_number: Optional[str] = None

    class Config:
        orm_mode = True
        from_attributes = True


# -------------------- Helpers --------------------
def _af_table(db: Session) -> Table:
    """Reflect the accommodation_files table (id, file_no, house_id, ...)."""
    engine = db.get_bind()
    meta = MetaData()
    return Table("accommodation_files", meta, autoload_with=engine)


def _house_to_out(h: House) -> HouseOut:
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


def _upsert_accommodation_file(db: Session, house_id: int, file_no: str | None) -> None:
    """
    Ensure accommodation_files mirrors the house's file number.
    - If file_no is None/blank: unlink any row pointing to this house.
    - Else: find by file_no; if exists and linked elsewhere -> 409; otherwise link/create.
    """
    af = _af_table(db)

    # Always unlink any row currently pointing to this house if we're about to change it
    # (Do this first to avoid "linked elsewhere" false positives when moving numbers around)
    db.execute(af.update().where(af.c.house_id == house_id).values(house_id=None))

    if not file_no:
        # Nothing else to do; we only unlinked
        db.commit()
        return

    existing = db.execute(
        select(af.c.id, af.c.house_id).where(af.c.file_no == file_no)
    ).first()

    if existing:
        if existing.house_id and existing.house_id != house_id:
            raise HTTPException(409, "That accommodation file is already linked to another house")
        # Link it to this house
        db.execute(
            af.update().where(af.c.id == existing.id).values(house_id=house_id)
        )
    else:
        # Create new row
        db.execute(
            af.insert().values(file_no=file_no, house_id=house_id)
        )

    db.commit()


# -------------------- CRUD Endpoints --------------------
@router.post("", response_model=HouseOut)
def create_house(
    payload: HouseIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleEnum.admin, RoleEnum.operator)),
):
    quarter_no = (payload.quarter_no or "").strip()
    if not quarter_no:
        raise HTTPException(400, "Quarter No is required")

    t = (payload.type_letter or "").strip().upper()
    if t not in ALLOWED_TYPES:
        raise HTTPException(400, "Type must be one of A–H")

    # Uniqueness within colony
    exists = db.scalar(
        select(House).where(House.colony_id == payload.colony_id, House.house_no == quarter_no)
    )
    if exists:
        raise HTTPException(400, "A house with this Quarter No already exists in the selected colony")

    h = House(
        colony_id=payload.colony_id,
        house_no=quarter_no,
        house_type=t,
        status="available",
    )
    if hasattr(House, "street"):
        h.street = payload.street
    if hasattr(House, "sector"):
        h.sector = payload.sector

    # Set houses.file_number if provided
    file_no = (payload.file_number or "").strip() or None
    if hasattr(House, "file_number"):
        h.file_number = file_no

    db.add(h)
    db.commit()
    db.refresh(h)

    # Mirror to accommodation_files
    _upsert_accommodation_file(db, h.id, file_no)

    return _house_to_out(h)


@router.get("", response_model=List[HouseOut])
def list_houses(
    status: Optional[str] = Query(default=None, description="Filter by status"),
    type_letter: Optional[str] = Query(default=None, description="Filter by Type A–H"),
    sector: Optional[str] = Query(default=None, description="Filter by sector"),
    file_number: Optional[str] = Query(default=None, description="Filter by file number"),
    q: Optional[str] = Query(default=None, description="Search quarter no or file number"),
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
    if file_number and hasattr(House, "file_number"):
        stmt = stmt.where(House.file_number == file_number)
    if q:
        # basic search across quarter_no and file_number
        like = f"%{q}%"
        clauses = [House.house_no.like(like)]
        if hasattr(House, "file_number"):
            clauses.append(House.file_number.like(like))
        stmt = stmt.where(func.coalesce(*clauses).is_not(None))  # simple way to apply OR without text()

    houses = db.scalars(stmt.order_by(House.id.desc())).all()
    return [_house_to_out(h) for h in houses]


@router.get("/{house_id}", response_model=HouseOut)
def get_house(
    house_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    h = db.get(House, house_id)
    if not h:
        raise HTTPException(404, "House not found")
    return _house_to_out(h)


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

    quarter_no = (payload.quarter_no or "").strip()
    if not quarter_no:
        raise HTTPException(400, "Quarter No is required")

    t = (payload.type_letter or "").strip().upper()
    if t not in ALLOWED_TYPES:
        raise HTTPException(400, "Type must be one of A–H")

    # Uniqueness within colony
    conflict = db.scalar(
        select(House).where(House.id != house_id, House.colony_id == payload.colony_id, House.house_no == quarter_no)
    )
    if conflict:
        raise HTTPException(400, "Another house with the same Quarter No exists in that colony")

    h.colony_id = payload.colony_id
    h.house_no = quarter_no
    h.house_type = t
    if hasattr(House, "street"):
        h.street = payload.street
    if hasattr(House, "sector"):
        h.sector = payload.sector

    # Update houses.file_number if provided; keep as-is if None (no change)
    if payload.file_number is not None and hasattr(House, "file_number"):
        new_file_no = (payload.file_number or "").strip() or None
        h.file_number = new_file_no
    else:
        new_file_no = getattr(h, "file_number", None)

    db.add(h)
    db.commit()
    db.refresh(h)

    # Mirror to accommodation_files
    _upsert_accommodation_file(db, h.id, new_file_no)

    return _house_to_out(h)


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

    # Unlink any accommodation_files pointing to this house
    af = _af_table(db)
    db.execute(af.update().where(af.c.house_id == house_id).values(house_id=None))

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
