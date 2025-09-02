from datetime import date
from typing import Optional, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from app.api.deps import get_db
from app.schemas import allotment as s
from app.models import Allotment, House
from app.crud import allotment as crud

router = APIRouter(prefix="/allotments", tags=["allotments"])

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
    stmt = stmt.offset(skip).limit(limit)
    rows = db.execute(stmt).scalars().all()
    out = []
    for a in rows:
        # compute period of stay in days (use today if still active)
        end = a.end_date or date.today()
        delta = (end - a.start_date).days if a.start_date else None
        out.append(s.AllotmentOut.from_orm(a).copy(update={
            "period_of_stay": delta,
            "house_file_no": a.house.file_no if a.house else None,
            "house_qtr_no": a.house.qtr_no if a.house else None,
        }))
    return out

@router.post("/", response_model=s.AllotmentOut, status_code=201)
def create_allotment(payload: s.AllotmentCreate, db: Session = Depends(get_db)):
    obj = crud.create(db, payload)
    # when created, mark house occupied
    house = db.get(House, obj.house_id)
    if house:
        house.status = "occupied"
        db.add(house); db.commit()
    return s.AllotmentOut.from_orm(obj).copy(update={
        "period_of_stay": (((payload.end_date or date.today()) - payload.start_date).days
                        if payload.start_date else None),
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
    # when ended, mark house vacant
    house = db.get(House, obj.house_id)
    if house:
        house.status = "vacant"
        db.add(house); db.commit()
    end = obj.end_date or date.today()
    delta = (end - obj.start_date).days if obj.start_date else None
    return s.AllotmentOut.from_orm(obj).copy(update={
        "period_of_stay": delta,
        "house_file_no": house.file_no if house else None,
        "house_qtr_no": house.qtr_no if house else None,
    })
