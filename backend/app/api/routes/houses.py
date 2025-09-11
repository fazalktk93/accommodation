from typing import Optional, List
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import select, or_, and_, func

from app.api.deps import get_db, pagination_params
from app.schemas import house as s
from app.crud import house as crud
from app.core.security import require_permissions
from app.models.house import House

router = APIRouter(prefix="/houses", tags=["houses"])

@router.get("/", response_model=List[s.HouseOut])
def list_houses(
    response: Response,
    # Keep your old query style but make it much more capable
    q: Optional[str] = Query(None, description="Free-text search across file_no, qtr_no, street, sector, type_code"),
    sector: Optional[str] = Query(None),
    type_code: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    sort: str = Query("id", description="Column to sort by (e.g. id, file_no, qtr_no, sector, type_code, status)"),
    order: str = Query("asc", pattern="^(asc|desc)$"),
    page_offset_limit: dict = Depends(pagination_params),
    db: Session = Depends(get_db),
):
    """
    Returns a LIST (same as before for UI compatibility) but also sets X-Total-Count header.
    Supports:
      - offset/limit pagination (non-breaking)
      - free-text search (?q=)
      - field filters (?sector=, ?type_code=, ?status=)
      - sorting (?sort=file_no&order=desc)
    """
    offset = page_offset_limit["offset"]
    limit = page_offset_limit["limit"]

    stmt = select(House)
    filters = []

    if q:
        like = f"%{q}%"
        filters.append(or_(
            House.file_no.ilike(like),
            House.qtr_no.ilike(like),
            House.street.ilike(like),
            House.sector.ilike(like),
            House.type_code.ilike(like),
        ))
    if sector:
        filters.append(House.sector == sector)
    if type_code:
        filters.append(House.type_code == type_code)
    if status:
        filters.append(House.status == status)

    if filters:
        stmt = stmt.where(and_(*filters))

    # Count first (fast on indexed columns)
    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    response.headers["X-Total-Count"] = str(total)

    # Sorting – default by id to keep deterministic order
    sort_col = getattr(House, sort, None)
    if sort_col is None:
        sort_col = House.id
    stmt = stmt.order_by(sort_col.desc() if order.lower() == "desc" else sort_col.asc())

    # Pagination window
    stmt = stmt.offset(offset).limit(limit)

    rows = db.execute(stmt).scalars().all()
    # Response model remains List[HouseOut] for backward compatibility
    return rows


@router.get("/{house_id}", response_model=s.HouseOut)
def get_house(house_id: int, db: Session = Depends(get_db)):
    return crud.get(db, house_id)


@router.get("/by-file/{file_no}", response_model=s.HouseOut)
def get_house_by_file(file_no: str, db: Session = Depends(get_db)):
    return crud.get_by_file(db, file_no)


@router.post("/", response_model=s.HouseOut, status_code=201)
def create_house(
    payload: s.HouseCreate,
    db: Session = Depends(get_db),
    user=Depends(require_permissions("houses:create")),
):
    # Optional: enforce uniqueness for file_no defensively
    existing = crud.get_by_file_opt(db, payload.file_no)
    if existing:
        from fastapi import HTTPException, status as http_status
        raise HTTPException(status_code=http_status.HTTP_409_CONFLICT, detail="file_no already exists")
    return crud.create(db, payload)


@router.patch("/{house_id}", response_model=s.HouseOut)
def update_house(
    house_id: int,
    payload: s.HouseUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_permissions("houses:update")),
):
    # Optional: if changing file_no, prevent duplicates
    if payload.file_no:
        other = crud.get_by_file_opt(db, payload.file_no)
        if other and other.id != house_id:
            from fastapi import HTTPException, status as http_status
            raise HTTPException(status_code=http_status.HTTP_409_CONFLICT, detail="file_no already exists")
    return crud.update(db, house_id, payload)


@router.delete("/{house_id}", status_code=204)
def delete_house(
    house_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_permissions("houses:delete")),
):
    crud.delete(db, house_id)
    return None
