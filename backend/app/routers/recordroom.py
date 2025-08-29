from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func, desc, and_
from pydantic import BaseModel

from ..deps import get_db, get_current_user
from ..models.domain import FileMovement, User, House  # adjust import if your models are split
from sqlalchemy import Table, MetaData

router = APIRouter(prefix="/recordroom", tags=["Record Room"])

# We’ll reflect accommodation_files lightly to avoid model drift
meta = MetaData()
accommodation_files = Table("accommodation_files", meta)

# ---------- Schemas ----------
class FileLite(BaseModel):
    id: int                      # accommodation_file_id
    file_number: str             # from accommodation_files.file_no
    house_id: Optional[int] = None
    house_no: Optional[str] = None
    sector: Optional[str] = None

class MovementOut(BaseModel):
    id: int
    file_number: str
    movement: str
    moved_at: str
    to_whom: Optional[str] = None
    remarks: Optional[str] = None

class Page(BaseModel):
    page: int
    per_page: int
    total: int
    items: List[MovementOut]

class IssueIn(BaseModel):
    accommodation_file_id: int
    to_whom: str
    remarks: Optional[str] = None

class ReceiveIn(BaseModel):
    movement_id: int
    remarks: Optional[str] = None

def paginate(q, page: int, per_page: int, db: Session):
    total = db.scalar(select(func.count()).select_from(q.subquery()))
    rows = db.execute(q.offset((page - 1) * per_page).limit(per_page)).all()
    return total, rows

# ---------- Endpoints ----------

@router.get("/files", response_model=List[FileLite])
def list_files(q: str = Query("", description="search by file number"),
               db: Session = Depends(get_db),
               user: User = Depends(get_current_user)):
    """
    Dropdown source:
      - accommodation_files.file_no as file_number
      - join houses for house_no/sector label
    """
    stmt = (
        select(
            accommodation_files.c.id.label("id"),
            accommodation_files.c.file_no.label("file_number"),
            accommodation_files.c.house_id.label("house_id"),
            House.house_no,
            House.sector,
        )
        .select_from(accommodation_files.outerjoin(House, House.id == accommodation_files.c.house_id))
        .where(accommodation_files.c.file_no.is_not(None))
        .where(accommodation_files.c.file_no.ilike(f"%{q}%"))
        .order_by(accommodation_files.c.file_no)
        .limit(30)
    )
    rows = db.execute(stmt).all()
    return [FileLite(
        id=r.id,
        file_number=r.file_number,
        house_id=r.house_id,
        house_no=r.house_no,
        sector=r.sector
    ) for r in rows]

@router.get("/movements", response_model=Page)
def list_movements(page: int = Query(1, ge=1),
                   per_page: int = Query(10, ge=1, le=100),
                   status: str = Query("open", pattern="^(open|all)$"),
                   db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    """
    Latest movement per file_number. 'open' = latest is 'issue'.
    """
    latest = (
        select(FileMovement.file_number,
               func.max(FileMovement.moved_at).label("last_at"))
        .where(FileMovement.file_number.is_not(None))
        .group_by(FileMovement.file_number)
        .subquery()
    )
    base = (
        select(
            FileMovement.id,
            FileMovement.file_number,
            FileMovement.movement,
            FileMovement.moved_at,
            FileMovement.to_whom,
            FileMovement.remarks,
        )
        .join(latest,
              and_(latest.c.file_number == FileMovement.file_number,
                   latest.c.last_at == FileMovement.moved_at))
        .order_by(desc(FileMovement.moved_at))
    )
    if status == "open":
        base = base.where(FileMovement.movement == "issue")

    total, rows = paginate(base, page, per_page, db)
    items = [MovementOut(
        id=r.id,
        file_number=r.file_number or "-",
        movement=r.movement,
        moved_at=r.moved_at.isoformat(),
        to_whom=r.to_whom,
        remarks=r.remarks,
    ) for r in rows]
    return Page(page=page, per_page=per_page, total=total, items=items)

@router.post("/issue", response_model=MovementOut)
def issue_file(payload: IssueIn,
               db: Session = Depends(get_db),
               user: User = Depends(get_current_user)):
    """
    Issue by accommodation_file_id: look up file_no and write both
    accommodation_file_id and file_number to file_movements.
    """
    # Get file_no and house info for label
    af = db.execute(
        select(accommodation_files.c.file_no, accommodation_files.c.house_id)
        .where(accommodation_files.c.id == payload.accommodation_file_id)
    ).first()
    if not af:
        raise HTTPException(404, "Accommodation file not found")

    mv = FileMovement(
        accommodation_file_id=payload.accommodation_file_id,
        file_number=af.file_no,          # keep denormalized copy for easy queries
        movement="issue",
        to_whom=payload.to_whom,
        remarks=payload.remarks,
        moved_by_user_id=user.id if user else None,
    )
    db.add(mv); db.commit(); db.refresh(mv)

    return MovementOut(
        id=mv.id,
        file_number=mv.file_number or "-",
        movement=mv.movement,
        moved_at=mv.moved_at.isoformat(),
        to_whom=mv.to_whom,
        remarks=mv.remarks,
    )

@router.post("/receive", response_model=MovementOut)
def receive_file(payload: ReceiveIn,
                 db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    """
    Close an open movement by movement_id (create a 'receive' entry).
    """
    open_mv = db.get(FileMovement, payload.movement_id)
    if not open_mv or open_mv.movement != "issue":
        raise HTTPException(404, "Open movement not found")

    mv2 = FileMovement(
        accommodation_file_id=getattr(open_mv, "accommodation_file_id", None),
        file_number=getattr(open_mv, "file_number", None),
        movement="receive",
        to_whom=None,
        remarks=payload.remarks,
        moved_by_user_id=user.id if user else None,
    )
    db.add(mv2); db.commit(); db.refresh(mv2)

    return MovementOut(
        id=mv2.id,
        file_number=mv2.file_number or "-
