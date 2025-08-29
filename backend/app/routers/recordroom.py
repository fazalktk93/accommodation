from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func, desc
from pydantic import BaseModel

from ..deps import get_db, get_current_user
from ..models.domain import FileMovement, User, House

router = APIRouter(prefix="/recordroom", tags=["Record Room"])

# ---------- Schemas ----------
class FileLite(BaseModel):
    id: int
    file_no: str
    house_id: int
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
    file_number: str
    to_whom: str
    remarks: Optional[str] = None

class ReceiveIn(BaseModel):
    file_number: str
    remarks: Optional[str] = None

# ---------- Helpers ----------
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
    Lightweight list for the dropdown: file_no + house_no + sector.
    """
    stmt = (
        select(House.id, House.file_no, House.id.label("house_id"),
               House.house_no, House.sector)
        .where(House.file_no.is_not(None))
        .where(House.file_no.ilike(f"%{q}%"))
        .order_by(House.file_no)
        .limit(30)
    )
    return [FileLite(id=r.id, file_no=r.file_no, house_id=r.house_id,
                     house_no=r.house_no, sector=r.sector)
            for r in db.execute(stmt)]

@router.get("/movements", response_model=Page)
def list_movements(page: int = Query(1, ge=1),
                   per_page: int = Query(10, ge=1, le=100),
                   status: str = Query("open", pattern="^(open|all)$"),
                   db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    """
    Paginated movements. status=open → only currently issued (no matching receive yet).
    In this simplified model we treat the latest movement per file:
      - last = 'issue'  → open
      - last = 'receive' → closed
    """
    # Latest movement per file_number by moved_at
    latest = (
        select(FileMovement.file_number,
               func.max(FileMovement.moved_at).label("last_at"))
        .group_by(FileMovement.file_number)
        .subquery()
    )
    base = (
        select(FileMovement.id,
               FileMovement.file_number,
               FileMovement.movement,
               FileMovement.moved_at,
               FileMovement.to_whom,
               FileMovement.remarks)
        .join(latest, (latest.c.file_number == FileMovement.file_number) &
                     (latest.c.last_at == FileMovement.moved_at))
        .order_by(desc(FileMovement.moved_at))
    )
    if status == "open":
        base = base.where(FileMovement.movement == "issue")

    total, rows = paginate(base, page, per_page, db)
    items = [MovementOut(
        id=r.id,
        file_number=r.file_number,
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
    Create an 'issue' movement for a file_number. Optionally link to a House if it exists.
    """
    # Try to find the house for convenience (not required)
    house = db.execute(select(House).where(House.file_no == payload.file_number)).scalar_one_or_none()
    mv = FileMovement(
        file_number=payload.file_number,
        movement="issue",
        to_whom=payload.to_whom,
        remarks=payload.remarks,
        house_id=house.id if house else None,
        moved_by_user_id=user.id if user else None,
    )
    db.add(mv)
    db.commit()
    db.refresh(mv)
    return MovementOut(
        id=mv.id, file_number=mv.file_number, movement=mv.movement,
        moved_at=mv.moved_at.isoformat(), to_whom=mv.to_whom, remarks=mv.remarks
    )

@router.post("/receive", response_model=MovementOut)
def receive_file(payload: ReceiveIn,
                 db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    """
    Create a 'receive' movement; the UI should choose the file_number that is currently open.
    """
    mv = FileMovement(
        file_number=payload.file_number,
        movement="receive",
        to_whom=None,
        remarks=payload.remarks,
        moved_by_user_id=user.id if user else None,
    )
    db.add(mv)
    db.commit()
    db.refresh(mv)
    return MovementOut(
        id=mv.id, file_number=mv.file_number, movement=mv.movement,
        moved_at=mv.moved_at.isoformat(), to_whom=mv.to_whom, remarks=mv.remarks
    )
