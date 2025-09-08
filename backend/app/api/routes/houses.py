from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, or_, asc, and_

from app.api.deps import get_db
from app.schemas import house as s
from app.crud import house as crud
from app.core.security import require_permissions
from app.models.house import House

router = APIRouter(prefix="/houses", tags=["houses"])

@router.get("/", response_model=List[s.HouseOut])
def list_houses(
    # UI sends ?offset= — map it to skip internally
    skip: int = Query(0, alias="offset", ge=0),
    # FIX: default must be <= max. Use default=50 and allow up to 3000
    limit: int = Query(50, ge=1, le=3000),
    # Free-text search across key columns
    q: Optional[str] = Query(None, description="Search across file_no, qtr_no, sector, street, type_code, status"),
    # Optional granular filters (all optional; combined with AND)
    file_no: Optional[str] = Query(None),
    qtr_no: Optional[str] = Query(None),
    sector: Optional[str] = Query(None),
    street: Optional[str] = Query(None),
    type_code: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user=Depends(require_permissions("houses:read"))
):
    stmt = select(House)
    where_clauses = []

    if q:
        like = f"%{q.strip()}%"
        where_clauses.append(
            or_(
                House.file_no.ilike(like),
                House.qtr_no.ilike(like),
                House.sector.ilike(like),
                House.street.ilike(like),
                House.type_code.ilike(like),
                House.status.ilike(like),
            )
        )

    # Field-specific filters (case-insensitive partial matches)
    def add_like(col, value):
        if value is not None and str(value).strip() != "":
            where_clauses.append(col.ilike(f"%{str(value).strip()}%"))

    add_like(House.file_no, file_no)
    add_like(House.qtr_no, qtr_no)
    add_like(House.sector, sector)
    add_like(House.street, street)
    add_like(House.type_code, type_code)
    add_like(House.status, status)

    if where_clauses:
        stmt = stmt.where(and_(*where_clauses))

    # Stable pagination
    stmt = stmt.order_by(asc(House.file_no)).offset(skip).limit(limit)

    rows = db.execute(stmt).scalars().all()
    return rows

@router.get("/{house_id}", response_model=s.HouseOut)
def get_house(house_id: int, db: Session = Depends(get_db), user=Depends(require_permissions("houses:read"))):
    return crud.get(db, house_id)

@router.get("/by-file/{file_no}", response_model=s.HouseOut)
def get_by_file(file_no: str, db: Session = Depends(get_db), user=Depends(require_permissions("houses:read"))):
    return crud.get_by_file(db, file_no)

@router.post("/", response_model=s.HouseOut, status_code=201)
def create_house(payload: s.HouseCreate, db: Session = Depends(get_db), user=Depends(require_permissions("houses:create"))):
    return crud.create(db, payload)

@router.patch("/{house_id}", response_model=s.HouseOut)
def update_house(house_id: int, payload: s.HouseUpdate, db: Session = Depends(get_db), user=Depends(require_permissions("houses:update"))):
    return crud.update(db, house_id, payload)

@router.delete("/{house_id}", status_code=204)
def delete_house(house_id: int, db: Session = Depends(get_db), user=Depends(require_permissions("houses:delete"))):
    crud.delete(db, house_id)
    return None
