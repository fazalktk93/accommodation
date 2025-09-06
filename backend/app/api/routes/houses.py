from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from app.core.security import get_current_user, require_permissions
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.schemas import house as s
from app.crud import house as crud

router = APIRouter(prefix="/houses", tags=["houses"])

const resp = await searchHouses({ q, limit: 100, offset: 0, type, status });

@router.get("/", response_model=List[s.HouseOut])
def list_houses(
    # accept offset from UI but keep your internal "skip"
    skip: int = Query(0, alias="offset", ge=0),
    limit: int = Query(100, ge=1, le=1000),
    # existing filters (keep whatever you already had)
    type: Optional[str] = None,
    status: Optional[str] = None,
    sector: Optional[str] = None,
    street: Optional[str] = None,
    qtr_no: Optional[str] = None,   # qtr is alphanumeric like "465-B" → string
    file_no: Optional[str] = None,
    # NEW: generic search term the UI sends
    q: Optional[str] = Query(None, description="Search across file_no, qtr_no, sector, street, type, status"),
    db: Session = Depends(get_db),
):
    rows = crud.list_houses(
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

    # Apply generic search if provided (simple, Python-side; fast to implement)
    if q:
        needle = q.strip().lower()
        if needle:
            def _has(h):
                return any(
                    needle in str(val).lower()
                    for val in [
                        getattr(h, "file_no", None),
                        getattr(h, "qtr_no", None),
                        getattr(h, "sector", None),
                        getattr(h, "street", None),
                        getattr(h, "type", None),
                        getattr(h, "status", None),
                        getattr(h, "id", None),
                    ]
                )
            rows = [h for h in rows if _has(h)]

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
