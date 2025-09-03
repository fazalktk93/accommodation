# backend/app/crud/allotment.py
from __future__ import annotations

from datetime import date as dt_date
from typing import Optional, List

from fastapi import HTTPException, status
from sqlalchemy import select, and_, asc, desc
from sqlalchemy.orm import Session

from app import models
from app.schemas import allotment as s

# Try to import QtrStatus if your model defines it; otherwise we’ll be tolerant.
try:
    from app.models.allotment import QtrStatus  # type: ignore
except Exception:  # pragma: no cover
    QtrStatus = None  # type: ignore


# ---------- Internal helpers ----------

def _is_active_from_obj(a: models.Allotment) -> bool:
    """Return True if allotment is active (supports either boolean 'active' or enum 'qtr_status')."""
    if hasattr(a, "active"):
        return bool(getattr(a, "active"))
    if QtrStatus is not None and hasattr(a, "qtr_status"):
        return getattr(a, "qtr_status") == QtrStatus.active
    # If neither field exists, default to False (not active)
    return False


def _set_active_on_obj(a: models.Allotment, active: bool) -> None:
    """Set allotment active/ended regardless of the underlying schema."""
    if hasattr(a, "active"):
        setattr(a, "active", active)
    if QtrStatus is not None and hasattr(a, "qtr_status"):
        setattr(a, "qtr_status", QtrStatus.active if active else QtrStatus.ended)


def _sync_house_status_from_allotment(db: Session, a: Optional[models.Allotment]) -> None:
    """Update house.status from the given allotment (unless house.status_manual is True)."""
    if not a:
        return
    house = db.get(models.House, a.house_id)
    if not house:
        return
    if hasattr(house, "status_manual") and getattr(house, "status_manual"):
        return
    house.status = "occupied" if _is_active_from_obj(a) else "vacant"
    db.add(house)


def _recompute_house_status(db: Session, house_id: int) -> None:
    """Recompute house.status from the latest allotment; default to 'vacant' if none."""
    house = db.get(models.House, house_id)
    if not house:
        return
    if hasattr(house, "status_manual") and getattr(house, "status_manual"):
        return

    latest = (
        db.execute(
            select(models.Allotment)
            .where(models.Allotment.house_id == house_id)
            .order_by(models.Allotment.id.desc())
            .limit(1)
        )
        .scalars()
        .first()
    )
    house.status = "occupied" if (latest and _is_active_from_obj(latest)) else "vacant"
    db.add(house)


def _name_column():
    """Return the best-guess name column on Allotment."""
    for cand in ("person_name", "allottee_name", "name"):
        if hasattr(models.Allotment, cand):
            return getattr(models.Allotment, cand)
    return None


def _file_no_column():
    """Return the best-guess file number column on House."""
    for cand in ("file_no", "file", "file_number", "fileno"):
        if hasattr(models.House, cand):
            return getattr(models.House, cand)
    return None


def _qtr_no_column():
    """Return the best-guess quarter number column on House."""
    for cand in ("qtr_no", "qtr", "quarter_no"):
        if hasattr(models.House, cand):
            return getattr(models.House, cand)
    return None


# ---------- CRUD API ----------

def get(db: Session, allotment_id: int) -> models.Allotment:
    obj = db.get(models.Allotment, allotment_id)
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Allotment not found")
    return obj


def list(
    db: Session,
    skip: int = 0,
    limit: int = 50,
    house_id: Optional[int] = None,
    active: Optional[bool] = None,
    person_name: Optional[str] = None,
    file_no: Optional[str] = None,
    qtr_no: Optional[int] = None,
    order_desc: bool = True,
) -> List[models.Allotment]:
    """
    List allotments with common filters and stable ordering:
      - active: maps to boolean 'active' OR enum 'qtr_status'
      - person_name: matches available name column
      - file_no, qtr_no: applied via House join when available
      - ordered by occupation_date desc (NULLS LAST) then id desc
    """
    stmt = select(models.Allotment)
    join_house = False
    conds = []

    if house_id is not None:
        conds.append(models.Allotment.house_id == house_id)

    # Handle 'active' filter across schemas
    if active is not None:
        if hasattr(models.Allotment, "active"):
            conds.append(getattr(models.Allotment, "active") == active)
        elif QtrStatus is not None and hasattr(models.Allotment, "qtr_status"):
            conds.append(getattr(models.Allotment, "qtr_status") == (QtrStatus.active if active else QtrStatus.ended))
        # else: silently no-op if neither field exists

    # Person name filter
    name_col = _name_column()
    if person_name and name_col is not None:
        conds.append(name_col.ilike(f"%{person_name}%"))

    # House filters
    fcol = _file_no_column()
    qcol = _qtr_no_column()
    if (file_no and fcol is not None) or (qtr_no is not None and qcol is not None):
        stmt = stmt.join(models.House)
        join_house = True
        if file_no and fcol is not None:
            conds.append(fcol.ilike(f"%{file_no}%"))
        if qtr_no is not None and qcol is not None:
            conds.append(qcol == qtr_no)

    if conds:
        stmt = stmt.where(and_(*conds))

    # Ordering
    occ = getattr(models.Allotment, "occupation_date", None)
    if occ is not None:
        # NULLS LAST behavior: True first for is_(None) → we want non-null first, so order by is_(None) asc
        nulls_order = asc(occ.is_(None))
        occ_order = desc(occ) if order_desc else asc(occ)
        id_order = desc(models.Allotment.id) if order_desc else asc(models.Allotment.id)
        stmt = stmt.order_by(nulls_order, occ_order, id_order)
    else:
        stmt = stmt.order_by(desc(models.Allotment.id) if order_desc else asc(models.Allotment.id))

    stmt = stmt.offset(skip).limit(limit)
    return db.execute(stmt).scalars().all()


def create(db: Session, obj_in: s.AllotmentCreate) -> models.Allotment:
    """
    Create an allotment and sync house.status (unless status_manual=True).
    """
    obj = models.Allotment(**obj_in.dict())
    try:
        db.add(obj)
        db.flush()  # get PK for status sync
        _sync_house_status_from_allotment(db, obj)
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(obj)
    return obj


def update(db: Session, allotment_id: int, obj_in: s.AllotmentUpdate) -> models.Allotment:
    """
    Partial update; re-sync house.status afterwards.
    """
    obj = get(db, allotment_id)
    data = obj_in.dict(exclude_unset=True)

    # If caller tries to flip between active/ended across schemas, honor it.
    # (e.g., setting qtr_status explicitly)
    for k, v in data.items():
        setattr(obj, k, v)

    try:
        db.add(obj)
        _sync_house_status_from_allotment(db, obj)
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(obj)
    return obj


def end(
    db: Session,
    allotment_id: int,
    notes: Optional[str] = None,
    vacation_date: Optional[dt_date] = None,
) -> models.Allotment:
    """
    End an active allotment:
      - Sets 'active' = False OR 'qtr_status' = ended
      - Sets vacation_date (defaults to today)
      - Appends notes if the 'notes' field exists
      - Syncs house.status -> 'vacant' (unless status_manual)
    """
    obj = get(db, allotment_id)

    # If already ended, just ensure vacation_date is set if provided
    if not _is_active_from_obj(obj):
        if vacation_date and hasattr(obj, "vacation_date"):
            setattr(obj, "vacation_date", vacation_date)
        if notes and hasattr(obj, "notes"):
            existing = getattr(obj, "notes") or ""
            sep = "\n" if existing else ""
            setattr(obj, "notes", f"{existing}{sep}{notes}")
        try:
            db.add(obj)
            db.commit()
        except Exception:
            db.rollback()
            raise
        db.refresh(obj)
        return obj

    # Mark ended
    _set_active_on_obj(obj, False)

    # Set vacation date if provided; else default to today (when field exists)
    if hasattr(obj, "vacation_date"):
        setattr(obj, "vacation_date", vacation_date or dt_date.today())

    # Append notes if field exists
    if notes and hasattr(obj, "notes"):
        existing = getattr(obj, "notes") or ""
        sep = "\n" if existing else ""
        setattr(obj, "notes", f"{existing}{sep}{notes}")

    try:
        db.add(obj)
        _sync_house_status_from_allotment(db, obj)  # will flip to 'vacant'
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(obj)
    return obj


def delete(db: Session, allotment_id: int) -> None:
    """
    Delete an allotment and recompute house.status from the latest remaining allotment.
    """
    obj = get(db, allotment_id)
    hid = obj.house_id
    try:
        db.delete(obj)
        _recompute_house_status(db, hid)
        db.commit()
    except Exception:
        db.rollback()
        raise
