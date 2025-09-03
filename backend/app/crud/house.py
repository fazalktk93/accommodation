from __future__ import annotations

from typing import Optional, List
from sqlalchemy import select, and_, or_, asc, desc
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app import models
from app.schemas.house import HouseCreate, HouseUpdate


# ---- tolerant column helpers ----

def _file_col():
    for n in ("file_no", "file", "file_number", "fileno"):
        if hasattr(models.House, n):
            return getattr(models.House, n)
    return None

def _qtr_col():
    for n in ("qtr_no", "qtr", "quarter_no"):
        if hasattr(models.House, n):
            return getattr(models.House, n)
    return None

def _sector_col():
    for n in ("sector",):
        if hasattr(models.House, n):
            return getattr(models.House, n)
    return None

def _street_col():
    for n in ("street",):
        if hasattr(models.House, n):
            return getattr(models.House, n)
    return None

def _status_col():
    for n in ("status",):
        if hasattr(models.House, n):
            return getattr(models.House, n)
    return None

def _type_col():
    for n in ("type_code", "type", "house_type"):
        if hasattr(models.House, n):
            return getattr(models.House, n)
    return None


# ---- CRUD ----

def get(db: Session, house_id: int) -> models.House:
    obj = db.get(models.House, house_id)
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="House not found")
    return obj


def get_by_file(db: Session, file_no: str) -> models.House:
    f = _file_col()
    if f is None:
        raise HTTPException(status_code=500, detail="House model has no file number column")
    row = db.execute(select(models.House).where(f == file_no)).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="House not found")
    return row


def list(
    db: Session,
    skip: int = 0,
    limit: int = 50,
    q: Optional[str] = None,
    status: Optional[str] = None,
    type_code: Optional[str] = None,
) -> List[models.House]:
    stmt = select(models.House)
    conds = []

    f = _file_col()
    qtr = _qtr_col()
    sec = _sector_col()
    strt = _street_col()
    st = _status_col()
    tp = _type_col()

    if q and (f or sec or strt or qtr):
        like = f"%{q}%"
        ors = []
        if f is not None:
            ors.append(f.ilike(like))
        if sec is not None:
            ors.append(sec.ilike(like))
        if strt is not None:
            ors.append(strt.ilike(like))
        if ors:
            conds.append(or_(*ors))
        if q.isdigit() and qtr is not None:
            conds.append(qtr == int(q))

    if status and st is not None:
        conds.append(st == status.lower())

    if type_code and tp is not None:
        conds.append(tp == type_code.upper())

    if conds:
        stmt = stmt.where(and_(*conds))

    # Order by file_no asc if available, fallback to id
    if f is not None:
        stmt = stmt.order_by(asc(f), asc(models.House.id))
    else:
        stmt = stmt.order_by(asc(models.House.id))

    stmt = stmt.offset(skip).limit(limit)
    return db.execute(stmt).scalars().all()


def create(db: Session, obj_in: HouseCreate) -> models.House:
    f = _file_col()
    # If we can enforce uniqueness by file_no, do it:
    if f is not None:
        exists = db.execute(select(models.House).where(f == obj_in.file_no)).scalar_one_or_none()
        if exists:
            return exists

    obj = models.House(**obj_in.dict())
    try:
        db.add(obj)
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(obj)
    return obj


def update(db: Session, house_id: int, obj_in: HouseUpdate) -> models.House:
    obj = get(db, house_id)
    data = obj_in.dict(exclude_unset=True)
    for k, v in data.items():
        setattr(obj, k, v)
    try:
        db.add(obj)
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(obj)
    return obj


def delete(db: Session, house_id: int) -> None:
    obj = get(db, house_id)
    try:
        db.delete(obj)
        db.commit()
    except Exception:
        db.rollback()
        raise
