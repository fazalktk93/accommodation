# backend/app/routers/houses.py
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import MetaData, Table, and_, select
from sqlalchemy.orm import Session

from ..deps import get_db, get_current_user, require_roles
from ..models.domain import House, Occupancy, RoleEnum, User
from ..schemas import OccupancyOut

router = APIRouter(prefix="/houses", tags=["Houses"])

# ---------- constants / helpers ----------
ALLOWED_TYPES = {"A", "B", "C", "D", "E", "F", "G", "H"}

def _norm_quarter(q: str) -> str:
    return (q or "").strip().upper()

# detect how House exposes file number (file_number vs file_no)
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
    colony_id: int
    quarter_no: str
    street: Optional[str] = None
    sector: Optional[str] = None
    type_letter: str               # A–H
    status: Optional[str] = None   # if omitted -> "available"
    file_number: Optional[str] = None  # accept either name in payload
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

# -------------------- accommodation_files helpers --------------------
def _af_table(db: Session) -> Table:
    engine = db.get_bind()
    meta = MetaData()
    return Table("accommodation_files", meta, autoload_with=engine)

def _assert_unique_file_number(db: Session, file_no: Optional[str], exclude_house_id: Optional[int] = None) -> None:
    """App-level guard: file number must be unique across houses."""
    if not file_no or not HOUSE_FILE_ATTR:
        return
    col = getattr(House, HOUSE_FILE_ATTR)
    exists = db.execute(
        select(House.id)
        .where(col == file_no)
        .where(House.id != (exclude_house_id or 0))
        .limit(1)
    ).first()
    if exists:
        raise HTTPException(409, "File number is already used by another house")

def _upsert_accommodation_file(db: Session, house_id: int, file_no: Optional[str]) -> None:
    """
    Keep accommodation_files consistent with the house's file number.
    - If file_no is None/blank: unlink any rows pointing to this house.
    - Else:
        * conflict if any row with same file_no linked to another house
        * keep first row, link it to this house
        * delete other duplicates for same file_no
        * if none exists, create with opened_at (if column exists)
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

    conflict = [r for r in rows if r.house_id and r.house_id != house_id]
    if conflict:
        raise HTTPException(409, "That accommodation file number is already linked to another house")

    if rows:
        keep_id = rows[0].id
        db.execute(af.update().where(af.c.id == keep_id).values(house_id=house_id))
        if len(rows) > 1:
            db.execute(af.delete().where(af.c.file_no == file_no).where(af.c.id != keep_id))
    else:
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
    qn = _norm_quarter(payload.quarter_no)

    # validate type
    t = (payload.type_letter or "").strip().upper()
    if t not in ALLOWED_TYPES:
        raise HTTPException(400, "type_letter must be one of A, B, C, D, E, F, G, H")

    # prevent duplicate (colony_id, quarter_no)
    exists = db.scalar(
        select(House).where(and_(House.colony_id == payload.colony_id, House.quarter_no == qn))
    )
    if exists:
        raise HTTPException(400, "This quarter number already exists in the selected colony.")

    # dedupe file number across houses
    incoming_file = payload.file_number or payload.file_no
    _assert_unique_file_number(db, incoming_file)

    row = House(
        colony_id=payload.colony_id,
        quarter_no=qn,
        street=payload.street,
        sector=payload.sector,
        type_letter=t,
        status=(payload.status or "available"),
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    # set file number (supports file_number OR file_no on model)
    if incoming_file and HOUSE_FILE_ATTR:
        _set_house_file(row, incoming_file)
        db.add(row)
        db.commit()
        db.refresh(row)
        _upsert_accommodation_file(db, row.id, incoming_file)

    return row

@router.get("", response_model=List[HouseOut])
def list_houses(
    q: Optional[str] = Query(default=None, description="search quarter number"),
    colony_id: Optional[int] = None,
    type_letter: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(House)

    if colony_id:
        stmt = stmt.where(House.colony_id == colony_id)
    if type_letter:
        stmt = stmt.where(House.type_letter == type_letter.strip().upper())
    if status:
        stmt = stmt.where(House.status == status)

    if q:
        like = f"%{q.strip().upper()}%"
        stmt = stmt.where(House.quarter_no.ilike(like))

    stmt = stmt.order_by(House.id.desc())
    # return ORM rows; Pydantic will serialize via from_attributes
    return db.scalars(stmt).all()

@router.get("/{house_id}", response_model=HouseOut)
def get_house(house_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    h = db.get(House, house_id)
    if not h:
        raise HTTPException(404, "House not found")
    return h

@router.put("/{house_id}", response_model=HouseOut)
def update_house(
    house_id: int,
    payload: HouseIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleEnum.admin, RoleEnum.operator)),
):
    row = db.get(House, house_id)
    if not row:
        raise HTTPException(404, "House not found")

    new_qn = _norm_quarter(payload.quarter_no)
    new_type = (payload.type_letter or "").strip().upper()
    if new_type not in ALLOWED_TYPES:
        raise HTTPException(400, "type_letter must be one of A, B, C, D, E, F, G, H")

    # uniqueness on (colony, quarter)
    if new_qn != row.quarter_no or payload.colony_id != row.colony_id:
        dupe = db.scalar(
            select(House).where(
                and_(House.colony_id == payload.colony_id, House.quarter_no == new_qn, House.id != house_id)
            )
        )
        if dupe:
            raise HTTPException(400, "Another house with this quarter number exists in this colony.")

    # file number logic
    incoming_file = payload.file_number or payload.file_no
    if incoming_file != _get_house_file(row):
        _assert_unique_file_number(db, incoming_file, exclude_house_id=house_id)

    row.colony_id = payload.colony_id
    row.quarter_no = new_qn
    row.street = payload.street
    row.sector = payload.sector
    row.type_letter = new_type
    if payload.status:
        row.status = payload.status

    if HOUSE_FILE_ATTR:
        _set_house_file(row, incoming_file)

    db.add(row)
    db.commit()
    db.refresh(row)

    _upsert_accommodation_file(db, row.id, incoming_file)
    return row

@router.delete("/{house_id}")
def delete_house(
    house_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleEnum.admin)),
):
    h = db.get(House, house_id)
    if not h:
        raise HTTPException(404, "House not found")

    # block delete if any occupancy history
    occ = db.scalar(select(Occupancy).where(Occupancy.house_id == house_id))
    if occ:
        raise HTTPException(400, "House has occupancy history; cannot delete")

    # unlink accommodation_files rows that reference this house
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
