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
    accommodation_file_id: int | None  # may be None if not created yet
    house_id: int
    file_number: str
    house_no: str | None = None
    sector: str | None = None

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
    house_id: int
    to_whom: str
    remarks: str | None = None

class ReceiveIn(BaseModel):
    movement_id: int
    remarks: str | None = None

def paginate(q, page: int, per_page: int, db: Session):
    total = db.scalar(select(func.count()).select_from(q.subquery()))
    rows = db.execute(q.offset((page - 1) * per_page).limit(per_page)).all()
    return total, rows

# ---------- Endpoints ----------

@router.get("/files", response_model=list[FileLite])
def list_files(q: str = Query("", description="search by file number"),
            db: Session = Depends(get_db),
            user: User = Depends(get_current_user)):
    stmt = (
        select(
            accommodation_files.c.id.label("accommodation_file_id"),
            House.id.label("house_id"),
            House.file_number.label("file_number"),
            House.house_no,
            House.sector,
        )
        .select_from(House.outerjoin(accommodation_files, accommodation_files.c.house_id == House.id))
        .where(House.file_number.is_not(None))
        .where(House.file_number.ilike(f"%{q}%"))
        .order_by(House.file_number)
        .limit(30)
    )
    rows = db.execute(stmt).all()
    return [
        FileLite(
            accommodation_file_id=r.accommodation_file_id,
            house_id=r.house_id,
            file_number=r.file_number,
            house_no=r.house_no,
            sector=r.sector,
        )
        for r in rows
    ]

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

    # Find the house; must have a file_number
    house = db.get(House, payload.house_id)
    if not house or not getattr(house, "file_number", None):
        raise HTTPException(404, "House or file number not found")

    # Find or create accommodation_file for this house
    af_row = db.execute(
        select(accommodation_files.c.id, accommodation_files.c.file_no)
        .where(accommodation_files.c.house_id == house.id)
    ).first()

    if af_row:
        af_id = af_row.id
        file_no = af_row.file_no or house.file_number
    else:
        # create it now so everything aligns
        ins = accommodation_files.insert().values(
            file_no=house.file_number,
            house_id=house.id,
        )
        af_id = db.execute(ins).inserted_primary_key[0]
        file_no = house.file_number
        db.commit()

    mv = FileMovement(
        accommodation_file_id=af_id,
        file_number=file_no,          # denormalized for fast listing
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
        file_number=mv2.file_number or "-",
        movement=mv2.movement,
        moved_at=mv2.moved_at.isoformat(),
        to_whom=mv2.to_whom,
        remarks=mv2.remarks,
    )
