from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_

from app.api.deps import get_db
from app.schemas import house as s
from app.models.house import House

router = APIRouter(prefix="/houses", tags=["houses"])


def _col(model, *names):
    """Return the first existing column attr name from the candidates."""
    for n in names:
        if hasattr(model, n):
            return getattr(model, n)
    return None


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

    file_no_col = _col(House, "file_no", "file", "file_number", "fileno")
    sector_col  = _col(House, "sector")
    street_col  = _col(House, "street")
    qtr_no_col  = _col(House, "qtr_no", "qtr", "quarter_no")
    status_col  = _col(House, "status")
    type_col    = _col(House, "type_code", "type", "house_type")

    if q and (file_no_col or sector_col or street_col or qtr_no_col):
        like = f"%{q}%"
        ors = []
        if file_no_col is not None:
            ors.append(file_no_col.ilike(like))
        if sector_col is not None:
            ors.append(sector_col.ilike(like))
        if street_col is not None:
            ors.append(street_col.ilike(like))
        if ors:
            conds.append(or_(*ors))
        if q.isdigit() and qtr_no_col is not None:
            conds.append(qtr_no_col == int(q))

    if status and status_col is not None:
        conds.append(status_col == status.lower())

    if type_code and type_col is not None:
        conds.append(type_col == type_code.upper())

    if conds:
        stmt = stmt.where(and_(*conds))

    rows = db.execute(stmt.offset(skip).limit(limit)).scalars().all()
    return rows


@router.get("/by-file/{file_no}", response_model=s.HouseOut)
def get_by_file(file_no: str, db: Session = Depends(get_db)):
    file_no_col = _col(House, "file_no", "file", "file_number", "fileno")
    if file_no_col is None:
        raise HTTPException(500, detail="House model has no file number column.")
    row = db.execute(select(House).where(file_no_col == file_no)).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="House not found")
    return row


@router.post("/", response_model=s.HouseOut, status_code=201)
def create_(payload: s.HouseCreate, db: Session = Depends(get_db)):
    from app.crud import house as crud
    return crud.create(db, payload)


@router.patch("/{house_id}", response_model=s.HouseOut)
def update_(house_id: int, payload: s.HouseUpdate, db: Session = Depends(get_db)):
    from app.crud import house as crud
    return crud.update(db, house_id, payload)


@router.delete("/{house_id}", status_code=204)
def delete_(house_id: int, db: Session = Depends(get_db)):
    from app.crud import house as crud
    crud.delete(db, house_id)
    return None
