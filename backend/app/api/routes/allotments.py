from datetime import date
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, and_

from app.api.deps import get_db
from app.schemas import allotment as s
from app.models import House
from app.models.allotment import Allotment

# Optional import; only used if present
try:
    from app.models.allotment import QtrStatus
except Exception:
    QtrStatus = None  # type: ignore

router = APIRouter(prefix="/allotments", tags=["allotments"])


def _period(occ: date | None, vac: date | None) -> int | None:
    if not occ:
        return None
    end = vac or date.today()
    return (end - occ).days


def _is_active_from_obj(a: Allotment) -> bool:
    # Prefer boolean "active" if it exists
    if hasattr(a, "active"):
        return bool(getattr(a, "active"))
    # Else map from qtr_status if available
    if QtrStatus is not None and hasattr(a, "qtr_status"):
        return getattr(a, "qtr_status") == QtrStatus.active
    # Default: not active
    return False


def _sync_house_status_from_allotment(db: Session, a: Allotment) -> None:
    if not a:
        return
    house = db.get(House, a.house_id)
    if not house:
        return
    # Respect manual flag if model has it
    if hasattr(house, "status_manual") and getattr(house, "status_manual"):
        return
    # occupied if active, else vacant
    house.status = "occupied" if _is_active_from_obj(a) else "vacant"
    db.add(house)
    db.commit()


def _recompute_house_status(db: Session, house_id: int) -> None:
    house = db.get(House, house_id)
    if not house:
        return
    if hasattr(house, "status_manual") and getattr(house, "status_manual"):
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
    house.status = "occupied" if (latest and _is_active_from_obj(latest)) else "vacant"
    db.add(house)
    db.commit()


@router.get("/", response_model=List[s.AllotmentOut])
def list_allotments(
    skip: int = 0,
    limit: int = 50,
    house_id: Optional[int] = None,
    active: Optional[bool] = None,      # works with boolean 'active' or enum 'qtr_status'
    person_name: Optional[str] = None,
    file_no: Optional[str] = None,
    qtr_no: Optional[int] = None,
    db: Session = Depends(get_db),
):
    stmt = select(Allotment).join(House)
    conds = []

    if house_id is not None:
        conds.append(Allotment.house_id == house_id)

    # active filter: support either schema
    if active is not None:
        if hasattr(Allotment, "active"):
            conds.append(getattr(Allotment, "active") == active)
        elif QtrStatus is not None and hasattr(Allotment, "qtr_status"):
            conds.append(getattr(Allotment, "qtr_status") == (QtrStatus.active if active else QtrStatus.ended))
        # else: no filter (schema has neither)

    # name filter: support possible field names
    name_col = None
    for cand in ("person_name", "allottee_name", "name"):
        if hasattr(Allotment, cand):
            name_col = getattr(Allotment, cand)
            break
    if person_name and name_col is not None:
        conds.append(name_col.ilike(f"%{person_name}%"))

    # house columns (tolerant)
    file_no_col = None
    for cand in ("file_no", "file", "file_number", "fileno"):
        if hasattr(House, cand):
            file_no_col = getattr(House, cand)
            break
    if file_no and file_no_col is not None:
        conds.append(file_no_col.ilike(f"%{file_no}%"))

    qtr_no_col = None
    for cand in ("qtr_no", "qtr", "quarter_no"):
        if hasattr(House, cand):
            qtr_no_col = getattr(House, cand)
            break
    if qtr_no is not None and qtr_no_col is not None:
        conds.append(qtr_no_col == qtr_no)

    if conds:
        stmt = stmt.where(and_(*conds))

    # preserve your original ordering
    occ_col = getattr(Allotment, "occupation_date", None)
    if occ_col is not None:
        stmt = stmt.order_by(
            occ_col.is_(None),
            occ_col.desc(),
            Allotment.id.desc(),
        )
    else:
        stmt = stmt.order_by(Allotment.id.desc())

    stmt = stmt.offset(skip).limit(limit)

    rows = db.execute(stmt).scalars().all()

    out: list[s.AllotmentOut] = []
    for a in rows:
        house = getattr(a, "house", None)
        out.append(
            s.AllotmentOut.from_orm(a).copy(update={
                "period_of_stay": _period(getattr(a, "occupation_date", None), getattr(a, "vacation_date", None)),
                "house_file_no": getattr(house, "file_no", None) if house else None,
                "house_qtr_no": getattr(house, "qtr_no", None) if house else None,
            })
        )
    return out


@router.get("/history/by-file/{file_no}", response_model=List[s.AllotmentOut])
def history_by_file(file_no: str, db: Session = Depends(get_db)):
    # resolve the house file column
    file_no_col = None
    for cand in ("file_no", "file", "file_number", "fileno"):
        if hasattr(House, cand):
            file_no_col = getattr(House, cand)
            break
    if file_no_col is None:
        raise HTTPException(500, detail="House model has no file number column.")

    stmt = (
        select(Allotment)
        .join(House)
        .where(file_no_col == file_no)
    )

    occ_col = getattr(Allotment, "occupation_date", None)
    if occ_col is not None:
        stmt = stmt.order_by(
            occ_col.is_(None),
            occ_col.desc(),
            Allotment.id.desc(),
        )
    else:
        stmt = stmt.order_by(Allotment.id.desc())

    rows = db.execute(stmt).scalars().all()
    out: list[s.AllotmentOut] = []
    for a in rows:
        house = getattr(a, "house", None)
        out.append(
            s.AllotmentOut.from_orm(a).copy(update={
                "period_of_stay": _period(getattr(a, "occupation_date", None), getattr(a, "vacation_date", None)),
                "house_file_no": getattr(house, "file_no", None) if house else None,
                "house_qtr_no": getattr(house, "qtr_no", None) if house else None,
            })
        )
    return out


@router.get("/{allotment_id}", response_model=s.AllotmentOut)
def get_allotment(allotment_id: int, db: Session = Depends(get_db)):
    obj = db.get(Allotment, allotment_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Not found")
    house = db.get(House, obj.house_id)
    return s.AllotmentOut.from_orm(obj).copy(update={
        "period_of_stay": _period(getattr(obj, "occupation_date", None), getattr(obj, "vacation_date", None)),
        "house_file_no": getattr(house, "file_no", None) if house else None,
        "house_qtr_no": getattr(house, "qtr_no", None) if house else None,
    })


@router.post("/", response_model=s.AllotmentOut, status_code=201)
def create_allotment(payload: s.AllotmentCreate, db: Session = Depends(get_db)):
    obj = crud.create(db, payload)
    _sync_house_status_from_allotment(db, obj)
    house = db.get(House, obj.house_id)
    return s.AllotmentOut.from_orm(obj).copy(update={
        "period_of_stay": _period(getattr(obj, "occupation_date", None), getattr(obj, "vacation_date", None)),
        "house_file_no": getattr(house, "file_no", None) if house else None,
        "house_qtr_no": getattr(house, "qtr_no", None) if house else None,
    })


@router.post("/{allotment_id}/end", response_model=s.AllotmentOut)
def end_allotment(
    allotment_id: int,
    notes: Optional[str] = None,
    vacation_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    obj = crud.end(db, allotment_id, notes, vacation_date)
    _sync_house_status_from_allotment(db, obj)
    house = db.get(House, obj.house_id)
    return s.AllotmentOut.from_orm(obj).copy(update={
        "period_of_stay": _period(getattr(obj, "occupation_date", None), getattr(obj, "vacation_date", None)),
        "house_file_no": getattr(house, "file_no", None) if house else None,
        "house_qtr_no": getattr(house, "qtr_no", None) if house else None,
    })


@router.patch("/{allotment_id}", response_model=s.AllotmentOut)
def update_allotment(
    allotment_id: int,
    payload: s.AllotmentUpdate,
    db: Session = Depends(get_db),
):
    obj = db.get(Allotment, allotment_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Not found")

    data = payload.dict(exclude_unset=True)
    for k, v in data.items():
        setattr(obj, k, v)
    db.add(obj)
    db.commit()
    db.refresh(obj)

    _sync_house_status_from_allotment(db, obj)

    house = db.get(House, obj.house_id)
    return s.AllotmentOut.from_orm(obj).copy(update={
        "period_of_stay": _period(getattr(obj, "occupation_date", None), getattr(obj, "vacation_date", None)),
        "house_file_no": getattr(house, "file_no", None) if house else None,
        "house_qtr_no": getattr(house, "qtr_no", None) if house else None,
    })


@router.delete("/{allotment_id}", status_code=204)
def delete_allotment(allotment_id: int, db: Session = Depends(get_db)):
    obj = db.get(Allotment, allotment_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Not found")
    hid = obj.house_id
    db.delete(obj)
    db.commit()
    _recompute_house_status(db, hid)
    return None
