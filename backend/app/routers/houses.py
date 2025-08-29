# backend/app/routers/houses.py
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, MetaData, Table, or_

from ..deps import get_db, require_roles, get_current_user
from ..models.domain import House, Occupancy, RoleEnum, User
from ..schemas import OccupancyOut
from pydantic import BaseModel

router = APIRouter(prefix="/houses", tags=["Houses"])

ALLOWED_TYPES = {"A", "B", "C", "D", "E", "F", "G", "H"}

# ---------- detect how House exposes file number (file_number vs file_no) ----------
HOUSE_FILE_ATTR = (
    "file_number" if hasattr(House, "file_number")
    else ("file_no" if hasattr(House, "file_no") else None)
)

def _get_house_file(h: House) -> Optional[str]:
    return getattr(h, HOUSE_FILE_ATTR, None) if HOUSE_FILE_ATTR else None

def _set_house_file(h: House, value: Optional[str]) -> None:
    if HOUSE_FILE_ATTR:
        setattr(h, HOUSE_FILE_ATTR, value)


# -------------------- Schemas --------------------
class HouseIn(BaseModel):
    colony_id: int = 1
    quarter_no: str
    street: Optional[str] = None
    sector: Optional[str] = None
    type_letter: str  # A–H
    file_number: Optional[str] = None  # accept either
    file_no: Optional[str] = None      # accept either


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
        file_number=_get_house_file(h),
    )

def _assert_unique_file_number(db: Session, file_no: Optional[str], exclude_house_id: Optional[int] = None) -> None:
    """App-level guard: file number must be unique across houses."""
    if not file_no or not HOUSE_FILE_ATTR:
        return
    col = getattr(House, HOUSE_FILE_ATTR)
    exists = db.execute(
        select(House.id).where(col == file_no).where(House.id != (exclude_house_id or 0)).limit(1)
    ).first()
    if exists:
        raise HTTPException(409, "File number is already used by another house")

def _upsert_accommodation_file(db: Session, house_id: int, file_no: Optional[str]) -> None:
    """
    Keep accommodation_files consistent with the house's file number.
    - If file_no is None/blank: unlink any rows pointing to this house.
    - Else:
        * check for ANY row with same file_no linked to a different house -> 409
        * choose one row (first) to keep, link it to this house
        * delete other duplicate rows with same file_no (data hygiene)
        * if none exists, create with opened_at
    """
    af = _af_table(db)

    # Unlink anything currently pointing to this house_id
    db.execute(af.update().where(af.c.house_id == house_id).values(house_id=None))

    if not file_no:
        db.commit()
        return

    rows = db.execute(
        select(af.c.id, af.c.house_id).where(af.c.file_no == file_no)
    ).all()

    # Conflict if ANY row with same file_no is linked to another house
    conflict = [r for r in rows if r.house_id and r.house_id != house_id]
    if conflict:
        raise HTTPException(409, "That accommodation file number is already linked to another house")

    if rows:
        # Keep the first, link it to this house
        keep_id = rows[0].id
        db.execute(af.update().where(af.c.id == keep_id).values(house_id=house_id))
        # Remove other duplicate rows with same file_no (optional but prevents future ambiguity)
        if len(rows) > 1:
            db.execute(af.delete().where(af.c.file_no == file_no).where(af.c.id != keep_id))
    else:
        # Create new row
        values = {"file_no": file_no, "house_id": house_id}
        if "opened_at" in af.c:
            values["opened_at"] = datetime.utcnow()
        db.execute(af.insert().values(**values))

    db.commit()


# -------------------- CRUD --------------------
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

    # unique quarter_no within colony
    exists = db.scalar(select(House).where(House.colony_id == payload.colony_id, House.house_no == qn))
    if exists:
        raise HTTPException(400, "A house with this Quarter No already exists in the selected colony")

    # normalize file number and enforce uniqueness across houses
    raw_file = payload.file_number or payload.file_no
    file_no = (raw_file or "").strip() or None
    _assert_unique_file_number(db, file_no)

    h = House(
        colony_id=payload.colony_id,
        house_no=qn,
        house_type=t,
        status="available",
    )
    if hasattr(House, "street"):
        h.street = payload.street
    if hasattr(House, "sector"):
        h.sector = payload.sector
    _set_house_file(h, file_no)

    db.add(h)
    db.commit()
    db.refresh(h)

    _upsert_accommodation_file(db, h.id, file_no)
    return _house_to_out(h)


@router.get("", response_model=List[HouseOut])
def list_houses(
    status: Optional[str] = Query(default=None),
    type_letter: Optional[str] = Query(default=None),
    sector: Optional[str] = Query(default=None),
    file_number: Optional[str] = Query(default=None),
    q: Optional[str] = Query(default=None),
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

    file_attr = getattr(House, HOUSE_FILE_ATTR) if HOUSE_FILE_ATTR else None
    if file_number and file_attr is not None:
        stmt = stmt.where(file_attr == file_number)
    if q:
        like = f"%{q}%"
        ors = [House.house_no.like(like)]
        if file_attr is not None:
            ors.append(file_attr.like(like))
        stmt = stmt.where(or_(*ors))

    houses = db.scalars(stmt.order_by(House.id.desc())).all()
    return [_house_to_out(h) for h in houses]


@router.get("/{house_id}", response_model=HouseOut)
def get_house(house_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
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

    qn = (payload.quarter_no or "").strip()
    if not qn:
        raise HTTPException(400, "Quarter No is required")

    t = (payload.type_letter or "").strip().upper()
    if t not in ALLOWED_TYPES:
        raise HTTPException(400, "Type must be one of A–H")

    # uniqueness for quarter_no within colony
    conflict = db.scalar(
        select(House).where(House.id != house_id, House.colony_id == payload.colony_id, House.house_no == qn)
    )
    if conflict:
        raise HTTPException(400, "Another house with the same Quarter No exists in that colony")

    # normalize new file number and enforce uniqueness if changed/provided
    raw_file = payload.file_number if payload.file_number is not None else payload.file_no
    if raw_file is not None:
        new_file_no = (raw_file or "").strip() or None
    else:
        new_file_no = _get_house_file(h)

    # Only check uniqueness if we actually changed it
    old_file = _get_house_file(h)
    if new_file_no != old_file:
        _assert_unique_file_number(db, new_file_no, exclude_house_id=house_id)

    h.colony_id = payload.colony_id
    h.house_no = qn
    h.house_type = t
    if hasattr(House, "street"):
        h.street = payload.street
    if hasattr(House, "sector"):
        h.sector = payload.sector
    _set_house_file(h, new_file_no)

    db.add(h)
    db.commit()
    db.refresh(h)

    _upsert_accommodation_file(db, h.id, new_file_no)
    return _house_to_out(h)


@router.delete("/{house_id}")
def delete_house(house_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleEnum.admin))):
    h = db.get(House, house_id)
    if not h:
        raise HTTPException(404, "House not found")

    occ = db.scalar(select(Occupancy).where(Occupancy.house_id == house_id))
    if occ:
        raise HTTPException(400, "House has occupancy history; cannot delete")

    af = _af_table(db)
    db.execute(af.update().where(af.c.house_id == house_id).values(house_id=None))

    db.delete(h)
    db.commit()
    return {"ok": True}


@router.get("/{house_id}/history", response_model=List[OccupancyOut])
def history(house_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.scalars(
        select(Occupancy).where(Occupancy.house_id == house_id).order_by(Occupancy.start_date.desc())
    ).all()
    return rows
