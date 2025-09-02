from datetime import date
from typing import Optional, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, desc
from app.api.deps import get_db
from app.schemas import allotment as s
from app.models import Allotment, House
from app.crud import allotment as crud

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
    stmt = select(Allotment).join(House)
    conds = []
    if house_id is not None:
        conds.append(Allotment.house_id == house_id)
    if active is not None:
        conds.append(Allotment.active == active)
    if person_name:
        conds.append(Allotment.person_name.ilike(f"%{person_name}%"))
    if file_no:
        conds.append(House.file_no.ilike(f"%{file_no}%"))
    if qtr_no is not None:
        conds.append(House.qtr_no == qtr_no)
    if conds:
        stmt = stmt.where(and_(*conds))
    stmt = stmt.order_by(desc(Allotment.occupation_date.nullslast()), desc(Allotment.id)).offset(skip).limit(limit)
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
        .order_by(desc(Allotment.occupation_date.nullslast()), desc(Allotment.id))
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

@router.post("/", response_model=s.AllotmentOut, status_code=201)
def create_allotment(payload: s.AllotmentCreate, db: Session = Depends(get_db)):
    obj = crud.create(db, payload)
    house = db.get(House, obj.house_id)
    # If occupied (occupation_date set and no vacation yet), mark house occupied
    if house and obj.occupation_date and not obj.vacation_date:
        house.status = "occupied"
        db.add(house)
        db.commit()
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
    house = db.get(House, obj.house_id)
    if house:
        house.status = "vacant"
        db.add(house)
        db.commit()
    return s.AllotmentOut.from_orm(obj).copy(update={
        "period_of_stay": _period(obj.occupation_date, obj.vacation_date),
        "house_file_no": house.file_no if house else None,
        "house_qtr_no": house.qtr_no if house else None,
    })
