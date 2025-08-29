# backend/app/routers/houses.py
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, MetaData, Table, or_, func

from ..deps import get_db, require_roles, get_current_user
from ..models.domain import House, Occupancy, RoleEnum, User
from ..schemas import OccupancyOut
from pydantic import BaseModel

router = APIRouter(prefix="/houses", tags=["Houses"])

ALLOWED_TYPES = {"A", "B", "C", "D", "E", "F", "G", "H"}


# -------------------- Pydantic Schemas --------------------
class HouseIn(BaseModel):
    colony_id: int = 1
    quarter_no: str
    street: Optional[str] = None
    sector: Optional[str] = None
    type_letter: str  # A–H
    # accept either name from the UI; we'll normalize
    file_number: Optional[str] = None
    file_no: Optional[str] = None


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


# -------------------- Helpers --------------------
def _af_table(db: Session) -> Table:
    """Reflect the accommodation_files table."""
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

def _upsert_accommodation_file(db: Session, house_id: int, file_no: Optional[str]) -> None:
    """
    Keep accommodation_files consistent with the house's file number.
    - If file_no is None/blank: unlink any rows pointing to this house.
    - Else: link existing same file_no or create a new row (sets opened_at).
    """
    af = _af_table(db)

    # unlink anything that currently points to this house_id
    db.execute(af.update().where(af.c.house_id == house_id).values(house_id=None))

    if not file_no:
        db.commit()
        return

    existing = db.execute(
        select(af.c.id, af.c.house_id).where(af.c.file_no == file_no)
    ).first()

    if existing:
        if existing.house_id and existing.house_id != house_id:
            raise HTTPException(409, "That accommodation file is already linked to another house")
        db.execute(af.update().where(af.c.id == existing.id).values(house_id=house_id))
    else:
        # INSERT with a real datetime object for opened_at (NOT NULL in your DB)
        values = {"file_no": file_no, "house_id": house_id}
        if "opened_at" in af.c:
            values["opened_at"] = datetime.utcnow()
        db.execute(af.insert().values(**values))

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

    # normalize file number from either field name
    raw_file = payload.file_number or payload.file_no
    file_no = (raw_file or "").strip() or None

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
    if hasattr(House, "file_number"):
        h.file_number = file_no

    db.add(h)
    db.commit()
    db.refresh(h)

    # Mirror to accommodation_files and set opened_at for new rows
    _upsert_accommodation_file(db, h.id, file_no)

    return _house_to_out(h)


@router.get("", response_model=List[HouseOut])
def list_houses(
    status: Optional[str] = Query(default=None, description="Filter by status"),
    type_letter: Optional[str] = Query(default=None, description="Filter by Type A–H"),
    sector: Optional[str] = Query(default=None, description="Filter by sector"),
    file_number: Optional[str] = Query(default=None, description="Filter by file number"),
    q: Optional[str] = Query(default=None, description="Search quarter no / file number"),
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
        like = f"%{q}%"
        ors = [House.house_no.like(like)]
        if hasattr(House, "file_number"):
            ors.append(House.file_number.like(like))
        stmt = stmt.where(or_(*ors))

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
        select(House).where(
            House.id != house_id,
            House.colony_id == payload.colony_id,
            House.house_no == quarter_no,
        )
    )
    if conflict:
        raise HTTPException(400, "Another house with the same Quarter No exists in that colony")

    # normalize file number updates
    raw_file = payload.file_number if payload.file_number is not None else payload.file_no
    if raw_file is not None:
        new_file_no = (raw_file or "").strip() or None
    else:
        new_file_no = getattr(h, "file_number", None)

    h.colony_id = payload.colony_id
    h.house_no = quarter_no
    h.house_type = t
    if hasattr(House, "street"):
        h.street = payload.street
    if hasattr(House, "sector"):
        h.sector = payload.sector
    if hasattr(House, "file_number"):
        h.file_number = new_file_no

    db.add(h)
    db.commit()
    db.refresh(h)

    # Mirror to accommodation_files (sets opened_at for new rows)
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

    # Safety: block delete if occupancy exists
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
