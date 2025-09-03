from __future__ import annotations

from datetime import date
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas import allotment as s
from app.crud import allotment as crud
from app import models

router = APIRouter(prefix="/allotments", tags=["allotments"])


def _period(occ: date | None, vac: date | None) -> int | None:
    if not occ:
        return None
    end = vac or date.today()
    return (end - occ).days


@router.get("/", response_model=List[s.AllotmentOut])
def list_allotments(
    skip: int = 0,
    limit: int = 50,
    house_id: Optional[int] = None,
    active: Optional[bool] = None,
    person_name: Optional[str] = None,
    file_no: Optional[str] = None,
    qtr_no: Optional[int] = None,
    db: Session = Depends(get_db),
):
    rows = crud.list(
        db,
        skip=skip,
        limit=limit,
        house_id=house_id,
        active=active,
        person_name=person_name,
        file_no=file_no,
        qtr_no=qtr_no,
    )
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
    obj = crud.get(db, allotment_id)
    house = db.get(models.House, obj.house_id)
    return s.AllotmentOut.from_orm(obj).copy(update={
        "period_of_stay": _period(getattr(obj, "occupation_date", None), getattr(obj, "vacation_date", None)),
        "house_file_no": getattr(house, "file_no", None) if house else None,
        "house_qtr_no": getattr(house, "qtr_no", None) if house else None,
    })


@router.post("/", response_model=s.AllotmentOut, status_code=201)
def create_allotment(payload: s.AllotmentCreate, db: Session = Depends(get_db)):
    obj = crud.create(db, payload)
    house = db.get(models.House, obj.house_id)
    return s.AllotmentOut.from_orm(obj).copy(update={
        "period_of_stay": _period(getattr(obj, "occupation_date", None), getattr(obj, "vacation_date", None)),
        "house_file_no": getattr(house, "file_no", None) if house else None,
        "house_qtr_no": getattr(house, "qtr_no", None) if house else None,
    })


@router.patch("/{allotment_id}", response_model=s.AllotmentOut)
def update_allotment(allotment_id: int, payload: s.AllotmentUpdate, db: Session = Depends(get_db)):
    obj = crud.update(db, allotment_id, payload)
    house = db.get(models.House, obj.house_id)
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
    obj = crud.end(db, allotment_id, notes=notes, vacation_date=vacation_date)
    house = db.get(models.House, obj.house_id)
    return s.AllotmentOut.from_orm(obj).copy(update={
        "period_of_stay": _period(getattr(obj, "occupation_date", None), getattr(obj, "vacation_date", None)),
        "house_file_no": getattr(house, "file_no", None) if house else None,
        "house_qtr_no": getattr(house, "qtr_no", None) if house else None,
    })


@router.delete("/{allotment_id}", status_code=204)
def delete_allotment(allotment_id: int, db: Session = Depends(get_db)):
    obj = crud.get(db, allotment_id)  # ensure 404 if missing
    hid = obj.house_id
    crud.delete(db, allotment_id)
    # crud.delete recomputes; no extra work here
    return None
