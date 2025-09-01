from datetime import date
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from typing import Optional
from app import models, schemas
from app.crud import house as house_crud
from app.crud.utils import paginate

def _add_years(d: date, years: int) -> date:
    try:
        return d.replace(year=d.year + years)
    except ValueError:
        return d.replace(month=2, day=28, year=d.year + years)

def create(db: Session, obj_in: schemas.allotment.AllotmentCreate):
    # resolve house by file_no if provided
    house_id = obj_in.house_id
    if not house_id and obj_in.file_no:
        house_id = house_crud.get_by_file_no(db, obj_in.file_no).id

    active = db.execute(
        select(models.allotment.Allotment).where(
            and_(models.allotment.Allotment.house_id == house_id,
                 models.allotment.Allotment.active == True)  # noqa
        )
    ).scalars().first()
    if active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This house already has an active allotment.")

    data = obj_in.dict(exclude={"file_no"})
    data["house_id"] = house_id
    dob: date = data["date_of_birth"]
    data["superannuation_date"] = _add_years(dob, 60)
    if data.get("vacation_date"):
        data["active"] = False
        data["end_date"] = data["vacation_date"]
    else:
        data["active"] = True

    obj = models.allotment.Allotment(**data)
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

def update(db: Session, allotment_id: int, obj_in: schemas.allotment.AllotmentUpdate):
    obj = db.get(models.allotment.Allotment, allotment_id)
    if not obj: raise HTTPException(404, "Allotment not found")

    changed = obj_in.dict(exclude_unset=True)
    if "date_of_birth" in changed and changed["date_of_birth"]:
        changed["superannuation_date"] = _add_years(changed["date_of_birth"], 60)
    if "vacation_date" in changed and changed["vacation_date"]:
        changed["active"] = False
        changed["end_date"] = changed["vacation_date"]

    for k, v in changed.items(): setattr(obj, k, v)
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

def end(db: Session, allotment_id: int, notes: Optional[str] = None, vacation_date: Optional[date] = None):
    obj = db.get(models.allotment.Allotment, allotment_id)
    if not obj: raise HTTPException(404, "Allotment not found")
    if not obj.active: raise HTTPException(400, "Allotment already ended")
    obj.active = False
    obj.vacation_date = vacation_date or date.today()
    obj.end_date = obj.vacation_date
    if notes: obj.notes = (obj.notes + "\n" if obj.notes else "") + notes
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

def list(db: Session, skip: int = 0, limit: int = 50, house_id: Optional[int] = None, active: Optional[bool] = None):
    q = db.query(models.allotment.Allotment)
    if house_id is not None: q = q.filter(models.allotment.Allotment.house_id == house_id)
    if active is True: q = q.filter(models.allotment.Allotment.active == True)  # noqa
    if active is False: q = q.filter(models.allotment.Allotment.active == False)  # noqa
    q = q.order_by(models.allotment.Allotment.id.desc())
    return paginate(q, skip, limit).all()

def get(db: Session, allotment_id: int):
    obj = db.get(models.allotment.Allotment, allotment_id)
    if not obj: raise HTTPException(404, "Allotment not found")
    return obj
