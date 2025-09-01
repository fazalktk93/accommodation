# backend/app/routers/houses.py
from typing import Optional, List
from datetime import datetime
from sqlalchemy import select, and_
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, MetaData, Table, or_

from ..deps import get_db, require_roles, get_current_user
from ..models.domain import House, Occupancy, RoleEnum, User
from ..schemas import OccupancyOut
from pydantic import BaseModel

router = APIRouter(prefix="/houses", tags=["Houses"])

def _norm_quarter(q: str) -> str:
    return (q or "").strip().upper()

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
def create_house(payload: HouseIn, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleEnum.admin, RoleEnum.operator))):
    qn = _norm_quarter(payload.quarter_no)
    # prevent duplicate (colony_id, quarter_no)
    exists = db.scalar(
        select(House).where(
            and_(House.colony_id == payload.colony_id, House.quarter_no == qn)
        )
    )
    if exists:
        raise HTTPException(400, "This quarter number already exists in the selected colony.")

    row = House(
        colony_id=payload.colony_id,
        quarter_no=qn,
        street=payload.street,
        sector=payload.sector,
        type_letter=payload.type_letter,
        file_number=payload.file_number,
        status=payload.status or "available",
    )
    db.add(row); db.commit(); db.refresh(row)
    return row


@router.get("", response_model=List[HouseOut])
def list_houses(
    q: Optional[str] = None,
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
        stmt = stmt.where(House.type_letter == type_letter.upper())
    if status:
        stmt = stmt.where(House.status == status)

    if q:
        like = f"%{q.strip().upper()}%"
        stmt = stmt.where(House.quarter_no.ilike(like))  # <- here

    stmt = stmt.order_by(House.id.desc())
    return db.scalars(stmt).all()



@router.get("/{house_id}", response_model=HouseOut)
def get_house(house_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    h = db.get(House, house_id)
    if not h:
        raise HTTPException(404, "House not found")
    return _house_to_out(h)


@router.put("/{house_id}", response_model=HouseOut)
def update_house(house_id: int, payload: HouseIn, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleEnum.admin, RoleEnum.operator))):
    row = db.get(House, house_id)
    if not row:
        raise HTTPException(404, "House not found")

    new_qn = _norm_quarter(payload.quarter_no)
    # if quarter_no or colony_id changed, re-check uniqueness
    if new_qn != row.quarter_no or payload.colony_id != row.colony_id:
        dupe = db.scalar(
            select(House).where(
                and_(House.colony_id == payload.colony_id, House.quarter_no == new_qn, House.id != house_id)
            )
        )
        if dupe:
            raise HTTPException(400, "Another house with this quarter number exists in this colony.")

    row.colony_id = payload.colony_id
    row.quarter_no = new_qn
    row.street = payload.street
    row.sector = payload.sector
    row.type_letter = payload.type_letter
    row.file_number = payload.file_number
    row.status = payload.status or row.status

    db.add(row); db.commit(); db.refresh(row)
    return row


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
