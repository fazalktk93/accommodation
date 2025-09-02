from typing import Optional, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_
from app.api.deps import get_db
from app.schemas import house as s
from app.models import House

router = APIRouter(prefix="/houses", tags=["houses"])

@router.get("/", response_model=List[s.HouseOut])
def list_(
    skip: int = 0,
    limit: int = 50,
    q: Optional[str] = None,
    status: Optional[str] = None,
    type_code: Optional[str] = None,
    db: Session = Depends(get_db)
):
    stmt = select(House)
    conds = []
    if q:
        like = f"%{q}%"
        conds.append(or_(
            House.file_no.ilike(like),
            House.sector.ilike(like),
            House.street.ilike(like),
        ))
        if q.isdigit():
            conds.append(House.qtr_no == int(q))
    if status:
        conds.append(House.status == status.lower())
    if type_code:
        conds.append(House.type_code == type_code.upper())
    if conds:
        stmt = stmt.where(and_(*conds))
    stmt = stmt.offset(skip).limit(limit)
    rows = db.execute(stmt).scalars().all()
    return rows

@router.post("/", response_model=s.HouseOut, status_code=201)
def create_(payload: s.HouseCreate, db: Session = Depends(get_db)):
    from app.crud import house as crud
    return crud.create(db, payload)

@router.patch("/{house_id}", response_model=s.HouseOut)
def update_(house_id: int, payload: s.HouseUpdate, db: Session = Depends(get_db)):
    from app.crud import house as crud
    return crud.update(db, house_id, payload)

@router.delete("/{house_id}")
def delete_(house_id: int, db: Session = Depends(get_db)):
    from app.crud import house as crud
    return crud.delete(db, house_id)
