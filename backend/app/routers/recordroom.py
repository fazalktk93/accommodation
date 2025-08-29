from typing import Optional, List, Tuple
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func, desc, and_
from pydantic import BaseModel

from ..deps import get_db, get_current_user
from ..models.domain import FileMovement, User, House  # adjust import path if different

router = APIRouter(prefix="/recordroom", tags=["Record Room"])

# -------- Pydantic --------
class FileLite(BaseModel):
    id: int
    file_no: str
    house_id: int
    house_no: Optional[str] = None
    sector: Optional[str] = None

class MovementOut(BaseModel):
    id: int
    file_no: str
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
    house_id: int                 # we’ll issue by house (always present)
    to_whom: str
    remarks: Optional[str] = None

class ReceiveIn(BaseModel):
    movement_id: int              # receive by open movement id
    remarks: Optional[str] = None

# -------- Helpers --------
def paginate(q, page: int, per_page: int, db: Session):
    total = db.scalar(select(func.count()).select_from(q.subquery()))
    rows = db.execute(q.offset((page - 1) * per_page).limit(per_page)).all()
    return total, rows

def using_file_number_column() -> bool:
    # Detect at runtime whether FileMovement has a 'file_number' mapped column
    return hasattr(FileMovement, "file_number")

# -------- Endpoints --------

@router.get("/files", response_model=List[FileLite])
def list_files(q: str = Query("", description="search by file number"),
               db: Session = Depends(get_db),
               user: User = Depends(get_current_user)):
    """
    Dropdown source. We use House (because it definitely has file_no/house_no/sector).
    """
    stmt = (
        select(House.id, House.file_no, House.house_no, House.sector)
        .where(House.file_no.is_not(None))
        .where(House.file_no.ilike(f"%{q}%"))
        .order_by(House.file_no)
        .limit(30)
    )
    out: List[FileLite] = []
    for r in db.execute(stmt):
        out.append(FileLite(
            id=r.id, file_no=r.file_no, house_id=r.id,
            house_no=r.house_no, sector=r.sector
        ))
    return out

@router.get("/movements", response_model=Page)
def list_movements(page: int = Query(1, ge=1),
                   per_page: int = Query(10, ge=1, le=100),
                   status: str = Query("open", pattern="^(open|all)$"),
                   db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    """
    Paginated list of latest movements per file (open = latest is 'issue').
    Works with either:
      - file_movements.file_number   (newer schema)
      - file_movements.house_id      (older schema)
    """
    if using_file_number_column():
        # Latest by file_number
        latest = (
            select(FileMovement.file_number,
                   func.max(FileMovement.moved_at).label("last_at"))
            .group_by(FileMovement.file_number)
            .subquery()
        )
        base = (
            select(
                FileMovement.id,
                FileMovement.movement,
                FileMovement.moved_at,
                FileMovement.to_whom,
                FileMovement.remarks,
                FileMovement.file_number.label("file_no"),
            )
            .join(latest,
                  and_(latest.c.file_number == FileMovement.file_number,
                       latest.c.last_at == FileMovement.moved_at))
            .order_by(desc(FileMovement.moved_at))
        )
        if status == "open":
            base = base.where(FileMovement.movement == "issue")
    else:
        # Latest by house_id, join to House to get file_no
        latest = (
            select(FileMovement.house_id,
                   func.max(FileMovement.moved_at).label("last_at"))
            .where(FileMovement.house_id.is_not(None))
            .group_by(FileMovement.house_id)
            .subquery()
        )
        base = (
            select(
                FileMovement.id,
                FileMovement.movement,
                FileMovement.moved_at,
                FileMovement.to_whom,
                FileMovement.remarks,
                House.file_no.label("file_no"),
            )
            .join(latest,
                  and_(latest.c.house_id == FileMovement.house_id,
                       latest.c.last_at == FileMovement.moved_at))
            .join(House, House.id == FileMovement.house_id, isouter=True)
            .order_by(desc(FileMovement.moved_at))
        )
        if status == "open":
            base = base.where(FileMovement.movement == "issue")

    total, rows = paginate(base, page, per_page, db)
    items = [
        MovementOut(
            id=r.id,
            file_no=r.file_no or "-",  # fallback
            movement=r.movement,
            moved_at=r.moved_at.isoformat(),
            to_whom=r.to_whom,
            remarks=r.remarks,
        )
        for r in rows
    ]
    return Page(page=page, per_page=per_page, total=total, items=items)

@router.post("/issue", response_model=MovementOut)
def issue_file(payload: IssueIn,
               db: Session = Depends(get_db),
               user: User = Depends(get_current_user)):
    """
    Create an 'issue' movement for a given house_id (we read file_no from House).
    """
    house = db.get(House, payload.house_id)
    if not house:
        raise HTTPException(404, "House not found")

    if using_file_number_column():
        mv = FileMovement(
            file_number=house.file_no,
            movement="issue",
            to_whom=payload.to_whom,
            remarks=payload.remarks,
            house_id=getattr(FileMovement, "house_id", None) and house.id or None,
            moved_by_user_id=user.id if user else None,
        )
    else:
        mv = FileMovement(
            house_id=house.id,
            movement="issue",
            to_whom=payload.to_whom,
            remarks=payload.remarks,
            moved_by_user_id=user.id if user else None,
        )

    db.add(mv)
    db.commit()
    db.refresh(mv)
    return MovementOut(
        id=mv.id,
        file_no=house.file_no or "-",
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
    Close an open movement by movement_id.
    """
    mv = db.get(FileMovement, payload.movement_id)
    if not mv or mv.movement != "issue":
        raise HTTPException(404, "Open movement not found")

    # find House (for file_no in response) if we don't have file_number column
    house: Optional[House] = None
    if not using_file_number_column():
        if getattr(mv, "house_id", None):
            house = db.get(House, mv.house_id)
    else:
        # we *do* have file_number column
        if getattr(mv, "house_id", None):
            house = db.get(House, mv.house_id)

    mv2 = FileMovement(
        file_number=getattr(mv, "file_number", None) or (house.file_no if house else None),
        house_id=getattr(mv, "house_id", None),
        movement="receive",
        to_whom=None,
        remarks=payload.remarks,
        moved_by_user_id=user.id if user else None,
    )
    db.add(mv2)
    db.commit()
    db.refresh(mv2)

    return MovementOut(
        id=mv2.id,
        file_no=(getattr(mv2, "file_number", None) or (house.file_no if house else "-") or "-"),
        movement=mv2.movement,
        moved_at=mv2.moved_at.isoformat(),
        to_whom=mv2.to_whom,
        remarks=mv2.remarks,
    )
