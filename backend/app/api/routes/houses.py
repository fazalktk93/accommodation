from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_

from app.api.deps import get_db
from app.schemas import house as s
from app.models.house import House

router = APIRouter(prefix="/houses", tags=["houses"])


@router.get("/", response_model=List[s.HouseOut])
def list_houses(
    skip: int = 0,
    limit: int = 50,
    q: Optional[str] = None,
    status: Optional[str] = None,
    type_code: Optional[str] = None,
    db: Session = Depends(get_db),
):
    stmt = select(House)
    conds = []

    if q:
        like = f"%{q}%"
        conds.append(
            or_(
                House.file_no.ilike(like),   # requires a file_no column on House
                House.sector.ilike(like),
                House.street.ilike(like),
            )
        )
        if q.isdigit():
            conds.append(House.qtr_no == int(q))

    if status:
        conds.append(House.status == status.lower())

    if type_code:
        conds.append(House.type_code == type_code.upper())

    if conds:
        stmt = stmt.where(and_(*conds))

    rows = db.execute(stmt.offset(skip).limit(limit)).scalars().all()
    return rows


@router.get("/by-file/{file_no}", response_model=s.HouseOut)
def get_by_file(file_no: str, db: Session = Depends(get_db)):
    row = db.execute(select(House).where(House.file_no == file_no)).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="House not found")
    return row


@router.post("/", response_model=s.HouseOut, status_code=201)
def create_house(payload: s.HouseCreate, db: Session = Depends(get_db)):
    from app.crud import house as crud
    return crud.create(db, payload)


@router.patch("/{house_id}", response_model=s.HouseOut)
def update_house(house_id: int, payload: s.HouseUpdate, db: Session = Depends(get_db)):
    from app.crud import house as crud
    return crud.update(db, house_id, payload)


@router.delete("/{house_id}", status_code=204)
def delete_house(house_id: int, db: Session = Depends(get_db)):
    from app.crud import house as crud
    crud.delete(db, house_id)
    return None
