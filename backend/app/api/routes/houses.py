from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas import house as s
from app.crud import house as crud
from app.core.security import require_permissions

router = APIRouter(prefix="/houses", tags=["houses"])

@router.get("/", response_model=List[s.HouseOut])
def list_houses(
    # UI sends ?offset= — map it to skip internally
    skip: int = Query(0, alias="offset", ge=0),
    limit: int = Query(3000, ge=1, le=1000),

    # optional filters coming from the UI
    type:  Optional[str] = None,
    status: Optional[str] = None,
    sector: Optional[str] = None,
    street: Optional[str] = None,
    qtr_no: Optional[str] = None,   # alphanumeric like "465-B"
    file_no: Optional[str] = None,

    # generic search box
    q: Optional[str] = Query(None, description="Search across file_no, qtr_no, sector, street, type, status"),
    db: Session = Depends(get_db),
):
    # call CRUD only with supported args
    rows = crud.list(db, skip=skip, limit=limit)

    # apply the individual filters (case-insensitive)
    def _eq(val, target):
        return str(val).lower() == str(target).lower()

    if type:
        rows = [h for h in rows if _eq(getattr(h, "type", ""), type)]
    if status:
        rows = [h for h in rows if _eq(getattr(h, "status", ""), status)]
    if sector:
        rows = [h for h in rows if _eq(getattr(h, "sector", ""), sector)]
    if street:
        rows = [h for h in rows if _eq(getattr(h, "street", ""), street)]
    if qtr_no:
        rows = [h for h in rows if _eq(getattr(h, "qtr_no", ""), qtr_no)]
    if file_no:
        rows = [h for h in rows if _eq(getattr(h, "file_no", ""), file_no)]

    # apply generic "q" search (substring match across common fields)
    if q:
        needle = q.strip().lower()
        if needle:
            rows = [
                h for h in rows
                if any(
                    needle in (str(getattr(h, fld, "")) or "").lower()
                    for fld in ("file_no", "qtr_no", "sector", "street", "type", "status", "id")
                )
            ]

    return rows

@router.get("/{house_id}", response_model=s.HouseOut)
def get_house(house_id: int, db: Session = Depends(get_db)):
    return crud.get(db, house_id)

@router.get("/by-file/{file_no}", response_model=s.HouseOut)
def get_by_file(file_no: str, db: Session = Depends(get_db)):
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
