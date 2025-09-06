from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from app.core.security import get_current_user, require_permissions
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.schemas import house as s
from app.crud import house as crud

router = APIRouter(prefix="/houses", tags=["houses"])


@router.get("/", response_model=List[s.HouseOut])
def list_houses(
    # accept ?offset= from UI while using "skip" internally
    skip: int = Query(0, alias="offset", ge=0),
    limit: int = Query(100, ge=1, le=1000),

    # existing filters
    type: Optional[str] = None,
    status: Optional[str] = None,
    sector: Optional[str] = None,
    street: Optional[str] = None,
    qtr_no: Optional[str] = None,   # qtr like "465-B" → string
    file_no: Optional[str] = None,

    # NEW generic search
    q: Optional[str] = Query(None, description="Search across file_no, qtr_no, sector, street, type, status"),
    db: Session = Depends(get_db),
):
    rows = crud.list(
        db,
        skip=skip,
        limit=limit,
        type=type,
        status=status,
        sector=sector,
        street=street,
        qtr_no=qtr_no,
        file_no=file_no,
    )

    # simple Python-side search
    if q:
        needle = q.strip().lower()
        if needle:
            def _match(h):
                return any(
                    needle in (str(getattr(h, attr, "")) or "").lower()
                    for attr in ("file_no", "qtr_no", "sector", "street", "type", "status", "id")
                )
            rows = [h for h in rows if _match(h)]

    return rows

@router.get("/{house_id}", response_model=s.HouseOut)
def get_house(house_id: int, db: Session = Depends(get_db)):
    return crud.get(db, house_id)

@router.get("/by-file/{file_no}", response_model=s.HouseOut)
def get_by_file(file_no: str, db: Session = Depends(get_db)):
    return crud.get_by_file(db, file_no)

@router.post("/", response_model=s.HouseOut, status_code=201)
def create_house(payload: s.HouseCreate, db: Session = Depends(get_db), user=Depends(require_permissions('houses:create'))):
    return crud.create(db, payload)

@router.patch("/{house_id}", response_model=s.HouseOut)
def update_house(house_id: int, payload: s.HouseUpdate, db: Session = Depends(get_db), user=Depends(require_permissions('houses:update'))):
    return crud.update(db, house_id, payload)

@router.delete("/{house_id}", status_code=204)
def delete_house(house_id: int, db: Session = Depends(get_db), user=Depends(require_permissions('houses:delete'))):
    crud.delete(db, house_id)
    return None
