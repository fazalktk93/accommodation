# backend/app/api/routes/allotments.py
from datetime import date
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, and_

from app.api.deps import get_db
from app.schemas import allotment as s
from app.models import House
from app.models.allotment import Allotment, QtrStatus
from app.crud import allotment as crud

router = APIRouter(prefix="/allotments", tags=["allotments"])


def _period(occ: date | None, vac: date | None) -> int | None:
    if not occ:
        return None
    end = vac or date.today()
    return (end - occ).days


def _sync_house_status_from_allotment(db: Session, a: Allotment) -> None:
    """Set house.status from allotment.qtr_status."""
    house = db.get(House, a.house_id) if a else None
    if not house:
        return
    house.status = "occupied" if a.qtr_status == QtrStatus.active else "vacant"
    db.add(house)
    db.commit()


def _recompute_house_status(db: Session, house_id: int) -> None:
    """After delete, recompute from latest allotment; default to vacant."""
    house = db.get(House, house_id)
    if not house:
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
    house.status = "occupied" if latest and latest.qtr_status == QtrStatus.active else "vacant"
    db.add(house)
    db.commit()


@router.get("/", response_model=List[s.AllotmentOut])
def list_allotments(
    skip: int = 0,
    limit: int = 50,
    house_id: Optional[int] = None,
    active: Optional[bool] = None,      # maps to qtr_status
    person_name: Optional[str] = None,
    file_no: Optional[str] = None,
    qtr_no: Optional[int] = None,
    db: Session = Depends(get_db),
):
    stmt = select(Allotment).join(House)
    conds = []

    if house_id is not None:
        conds.append(Allotment.house_id == house_id)

    if active is not None:
        conds.append(
            Allotment.qtr_status == (QtrStatus.active if active else QtrStatus.ended)
        )

    if person_name:
        conds.append(Allotment.person_name.ilike(f"%{person_name}%"))

    if file_no:
        conds.append(House.file_no.ilike(f"%{file_no}%"))

    if qtr_no is not None:
        conds.append(House.qtr_no == qtr_no)

    if conds:
        stmt = stmt.where(and_(*conds))

    stmt = stmt.order_by(
        Allotment.occupation_date.is_(None),
        Allotment.occupation_date.desc(),
        Allotment.id.desc(),
    ).offset(skip).limit(limit)

    rows = db.execute(stmt).scalars().all()

    out: list[s.AllotmentOut] = []
    for a in rows:
        out.append(
            s.AllotmentOut.from_orm(a).copy(update={
                "period_of_stay": _period(a.occupation_date, a.vacation_date),
                "house_file_no": a.house.file_no if a.house else None,
                "house_qtr_no": a.house.qtr_no if a.house else None,
            })
        )
    return out


@router.get("/history/by-file/{file_no}", response_model=List[s.AllotmentOut])
def history_by_file(file_no: str, db: Session = Depends(get_db)):
    stmt = (
        select(Allotment)
        .join(House)
        .where(House.file_no == file_no)
        .order_by(
            Allotment.occupation_date.is_(None),
            Allotment.occupation_date.desc(),
            Allotment.id.desc(),
        )
    )
    rows = db.execute(stmt).scalars().all()
    out: list[s.AllotmentOut] = []
    for a in rows:
        out.append(
            s.AllotmentOut.from_orm(a).copy(update={
                "period_of_stay": _period(a.occupation_date, a.vacation_date),
                "house_file_no": a.house.file_no if a.house else None,
                "house_qtr_no": a.house.qtr_no if a.house else None,
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
        "period_of_stay": _period(obj.occupation_date, obj.vacation_date),
        "house_file_no": house.file_no if house else None,
        "house_qtr_no": house.qtr_no if house else None,
    })


@router.post("/", response_model=s.AllotmentOut, status_code=201)
def create_allotment(payload: s.AllotmentCreate, db: Session = Depends(get_db)):
    obj = crud.create(db, payload)
    _sync_house_status_from_allotment(db, obj)
    house = db.get(House, obj.house_id)
    return s.AllotmentOut.from_orm(obj).copy(update={
        "period_of_stay": _period(obj.occupation_date, obj.vacation_date),
        "house_file_no": house.file_no if house else None,
        "house_qtr_no": house.qtr_no if house else None,
    })


@router.post("/{allotment_id}/end", response_model=s.AllotmentOut)
def end_allotment(
    allotment_id: int,
    notes: Optional[str] = None,
    vacation_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    obj = crud.end(db, allotment_id, notes, vacation_date)
    _sync_house_status_from_allotment(db, obj)  # will set to vacant
    house = db.get(House, obj.house_id)
    return s.AllotmentOut.from_orm(obj).copy(update={
        "period_of_stay": _period(obj.occupation_date, obj.vacation_date),
        "house_file_no": house.file_no if house else None,
        "house_qtr_no": house.qtr_no if house else None,
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

    # apply partial update
    data = payload.dict(exclude_unset=True)
    for k, v in data.items():
        setattr(obj, k, v)
    db.add(obj)
    db.commit()
    db.refresh(obj)

    _sync_house_status_from_allotment(db, obj)

    house = db.get(House, obj.house_id)
    return s.AllotmentOut.from_orm(obj).copy(update={
        "period_of_stay": _period(obj.occupation_date, obj.vacation_date),
        "house_file_no": house.file_no if house else None,
        "house_qtr_no": house.qtr_no if house else None,
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
