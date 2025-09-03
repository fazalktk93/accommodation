from __future__ import annotations

from datetime import date
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas import allotment as s
from app.crud import allotment as crud
from app.models import House, Allotment, QtrStatus

router = APIRouter(prefix="/allotments", tags=["allotments"])


def _period(occ: date | None, vac: date | None) -> int | None:
    if not occ:
        return None
    end = vac or date.today()
    return (end - occ).days


@router.get("/", response_model=List[s.AllotmentOut], name="list_allotments")
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
    return [
        s.AllotmentOut.from_orm(a).copy(
            update={
                "period_of_stay": _period(a.occupation_date, a.vacation_date),
                "house_file_no": a.house.file_no if a.house else None,
                "house_qtr_no": a.house.qtr_no if a.house else None,
            }
        )
        for a in rows
    ]


# Put this BEFORE "/{allotment_id}" so it can never be shadowed.
@router.get(
    "/history/by-file/{file_no:str}",
    response_model=List[s.AllotmentOut],
    name="history_by_file",
)
def history_by_file(file_no: str, db: Session = Depends(get_db)):
    rows = (
        db.execute(
            select(Allotment)
            .join(House)
            .where(House.file_no == file_no)
            .order_by(
                Allotment.occupation_date.is_(None),
                desc(Allotment.occupation_date),
                desc(Allotment.id),
            )
        )
        .scalars()
        .all()
    )
    return [
        s.AllotmentOut.from_orm(a).copy(
            update={
                "period_of_stay": _period(a.occupation_date, a.vacation_date),
                "house_file_no": a.house.file_no if a.house else None,
                "house_qtr_no": a.house.qtr_no if a.house else None,
            }
        )
        for a in rows
    ]


@router.get("/{allotment_id}", response_model=s.AllotmentOut, name="get_allotment")
def get_allotment(allotment_id: int, db: Session = Depends(get_db)):
    obj = crud.get(db, allotment_id)
    house = db.get(House, obj.house_id)
    return s.AllotmentOut.from_orm(obj).copy(
        update={
            "period_of_stay": _period(obj.occupation_date, obj.vacation_date),
            "house_file_no": house.file_no if house else None,
            "house_qtr_no": house.qtr_no if house else None,
        }
    )


@router.post("/", response_model=s.AllotmentOut, status_code=201, name="create_allotment")
def create_allotment(payload: s.AllotmentCreateFlexible, db: Session = Depends(get_db)):
    # Resolve house
    house_id = payload.house_id
    if not house_id and payload.house_file_no:
        h = db.query(House).filter(House.file_no == payload.house_file_no).first()
        if not h:
            raise HTTPException(status_code=422, detail="Unknown house_file_no")
        house_id = h.id
    if not house_id:
        raise HTTPException(status_code=422, detail="house_id or house_file_no is required")

    # Determine qtr_status
    qtr_status = payload.qtr_status
    if qtr_status is None and payload.active is not None:
        qtr_status = QtrStatus.active if payload.active else QtrStatus.ended
    if qtr_status is None:
        qtr_status = QtrStatus.active

    create_data = s.AllotmentCreate(
        house_id=house_id,
        person_name=payload.person_name,
        designation=payload.designation,
        directorate=payload.directorate,
        cnic=payload.cnic,
        pool=payload.pool,
        medium=payload.medium,
        bps=payload.bps,
        allotment_date=payload.allotment_date,
        occupation_date=payload.occupation_date,
        vacation_date=payload.vacation_date,
        dob=payload.dob,
        dor=payload.dor,
        retention_until=payload.retention_until,
        retention_last=payload.retention_last,
        qtr_status=qtr_status,
        allottee_status=payload.allottee_status or s.AllotteeStatus.in_service,  # type: ignore[attr-defined]
        notes=payload.notes,
    )
    obj = crud.create(db, create_data)
    house = db.get(House, obj.house_id)
    return s.AllotmentOut.from_orm(obj).copy(
        update={
            "period_of_stay": _period(obj.occupation_date, obj.vacation_date),
            "house_file_no": house.file_no if house else None,
            "house_qtr_no": house.qtr_no if house else None,
        }
    )


@router.patch("/{allotment_id}", response_model=s.AllotmentOut, name="update_allotment")
def update_allotment(allotment_id: int, payload: s.AllotmentUpdate, db: Session = Depends(get_db)):
    obj = crud.update(db, allotment_id, payload)
    house = db.get(House, obj.house_id)
    return s.AllotmentOut.from_orm(obj).copy(
        update={
            "period_of_stay": _period(obj.occupation_date, obj.vacation_date),
            "house_file_no": house.file_no if house else None,
            "house_qtr_no": house.qtr_no if house else None,
        }
    )


@router.post("/{allotment_id}/end", response_model=s.AllotmentOut, name="end_allotment")
def end_allotment(
    allotment_id: int,
    notes: Optional[str] = None,
    vacation_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    obj = crud.end(db, allotment_id, notes=notes, vacation_date=vacation_date)
    house = db.get(House, obj.house_id)
    return s.AllotmentOut.from_orm(obj).copy(
        update={
            "period_of_stay": _period(obj.occupation_date, obj.vacation_date),
            "house_file_no": house.file_no if house else None,
            "house_qtr_no": house.qtr_no if house else None,
        }
    )


@router.delete("/{allotment_id}", status_code=204, name="delete_allotment")
def delete_allotment(allotment_id: int, db: Session = Depends(get_db)):
    crud.delete(db, allotment_id)
    return None
