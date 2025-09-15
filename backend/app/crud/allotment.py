from __future__ import annotations

from datetime import date as dt_date
from typing import Optional, List

from fastapi import HTTPException, status
from sqlalchemy import select, and_, or_, desc
from sqlalchemy.orm import Session

from app.models import House, Allotment, QtrStatus
from app.schemas import allotment as s


def _is_active(a: Allotment) -> bool:
    return a.qtr_status == QtrStatus.active


def _compute_dor(dob: Optional[dt_date]) -> Optional[dt_date]:
    """Return DOB + 60 years, clamping 29-Feb to 28-Feb on non-leap years."""
    if not dob:
        return None
    try:
        return dob.replace(year=dob.year + 60)
    except ValueError:
        # leap day → clamp to Feb 28
        return dob.replace(year=dob.year + 60, month=2, day=28)


def _sync_house_status(db: Session, a: Optional[Allotment]) -> None:
    if not a:
        return
    h = db.get(House, a.house_id)
    if not h:
        return
    if getattr(h, "status_manual", False):
        return
    h.status = "occupied" if _is_active(a) else "vacant"
    db.add(h)


def _recompute_house_status(db: Session, house_id: int) -> None:
    h = db.get(House, house_id)
    if not h or getattr(h, "status_manual", False):
        return
    latest = (
        db.execute(
            select(Allotment)
            .where(Allotment.house_id == house_id)
            .order_by(Allotment.id.desc())
            .limit(1)
        )
        .scalars()
        .first()
    )
    h.status = "occupied" if (latest and _is_active(latest)) else "vacant"
    db.add(h)


def get(db: Session, allotment_id: int) -> Allotment:
    obj = db.get(Allotment, allotment_id)
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Allotment not found"
        )
    return obj


def list(
    db: Session,
    skip: int = 0,
    limit: int = 1000,  # keep sane default; your API caps to 1000
    house_id: Optional[int] = None,
    active: Optional[bool] = None,
    person_name: Optional[str] = None,
    file_no: Optional[str] = None,
    qtr_no: Optional[str] = None,
    q: Optional[str] = None,
) -> List[Allotment]:
    from app.models import House as H

    stmt = select(Allotment).join(H)
    conds = []

    if house_id is not None:
        conds.append(Allotment.house_id == house_id)
    if active is not None:
        conds.append(Allotment.qtr_status == (QtrStatus.active if active else QtrStatus.ended))
    if person_name:
        conds.append(Allotment.person_name.ilike(f"%{person_name}%"))
    if file_no:
        conds.append(H.file_no.ilike(f"%{file_no}%"))
    if qtr_no is not None:
        # STRING match, not numeric
        conds.append(H.qtr_no.ilike(f"%{qtr_no}%"))
    if q:
        like = f"%{q.strip()}%"
        conds.append(
            or_(
                Allotment.person_name.ilike(like),
                Allotment.cnic.ilike(like),
                Allotment.designation.ilike(like),
                Allotment.directorate.ilike(like),
                H.file_no.ilike(like),
                H.qtr_no.ilike(like),
                H.sector.ilike(like),
                H.street.ilike(like),
                H.type_code.ilike(like),
            )
        )

    if conds:
        stmt = stmt.where(and_(*conds))

    # newest first, then paginate
    stmt = stmt.order_by(desc(Allotment.id)).offset(skip).limit(limit)
    return db.execute(stmt).scalars().all()


def _end_previous_active_if_needed(
    db: Session, house_id: int, vacation_date: Optional[dt_date], force_end_previous: bool
) -> None:
    prev = (
        db.execute(
            select(Allotment)
            .where(
                Allotment.house_id == house_id,
                Allotment.qtr_status == QtrStatus.active,
            )
            .order_by(Allotment.id.desc())
            .limit(1)
        )
        .scalars()
        .first()
    )
    if not prev:
        return
    if not force_end_previous:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Active allotment already exists for this house (id={prev.id}). "
                f"End it first or set force_end_previous=true."
            ),
        )
    # force end previous
    prev.qtr_status = QtrStatus.ended
    if not prev.vacation_date:
        prev.vacation_date = vacation_date or dt_date.today()
    db.add(prev)


def create(
    db: Session, obj_in: s.AllotmentCreate, force_end_previous: bool = False
) -> Allotment:
    # ensure single active per house
    if obj_in.qtr_status == QtrStatus.active:
        _end_previous_active_if_needed(db, obj_in.house_id, obj_in.vacation_date, force_end_previous)

    data = obj_in.dict()
    # auto-fill DOR if DOB is provided
    if data.get("dob") and not data.get("dor"):
        data["dor"] = _compute_dor(data["dob"])

    obj = Allotment(**data)
    db.add(obj)
    db.flush()
    _sync_house_status(db, obj)
    db.commit()
    db.refresh(obj)
    return obj


def update(
    db: Session, allotment_id: int, obj_in: s.AllotmentUpdate, force_end_previous: bool = False
) -> Allotment:
    obj = get(db, allotment_id)
    data = obj_in.dict(exclude_unset=True)

    # becoming active? enforce single active per house
    if data.get("qtr_status") == QtrStatus.active and obj.qtr_status != QtrStatus.active:
        _end_previous_active_if_needed(
            db, obj.house_id, data.get("vacation_date"), force_end_previous
        )

    # if DOB is updated and DOR omitted, compute
    if "dob" in data and "dor" not in data and data["dob"]:
        data["dor"] = _compute_dor(data["dob"])

    for k, v in data.items():
        setattr(obj, k, v)

    db.add(obj)
    _sync_house_status(db, obj)
    db.commit()
    db.refresh(obj)
    return obj


def end(
    db: Session,
    allotment_id: int,
    notes: Optional[str] = None,
    vacation_date: Optional[dt_date] = None,
) -> Allotment:
    obj = get(db, allotment_id)
    obj.qtr_status = QtrStatus.ended
    if vacation_date:
        obj.vacation_date = vacation_date
    if notes:
        obj.notes = (obj.notes + "\n" if obj.notes else "") + notes
    db.add(obj)
    _sync_house_status(db, obj)
    db.commit()
    db.refresh(obj)
    return obj


def delete(db: Session, allotment_id: int) -> None:
    obj = get(db, allotment_id)
    hid = obj.house_id
    db.delete(obj)
    _recompute_house_status(db, hid)
    db.commit()
