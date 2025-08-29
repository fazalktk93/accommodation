# backend/app/routers/recordroom.py
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import select, func, desc, and_, Table, MetaData
from pydantic import BaseModel
from datetime import datetime

from ..deps import get_db, get_current_user  # we'll make this optional
from ..models.domain import FileMovement, House, User

router = APIRouter(prefix="/recordroom", tags=["Record Room"])

# ------- small helper: optional user (never fails) -------
def optional_user(request: Request) -> Optional[User]:
    try:
        # try the usual dependency path
        return get_current_user()  # if your get_current_user is a dependency function factory, comment this line
    except Exception:
        return None

# If your get_current_user is a FastAPI dependency (callable expecting DI),
# replace optional_user with a no-op and just don't use any user at all:
# def optional_user() -> None:
#     return None

# ------- reflect accommodation_files -------
def _af_table(db: Session) -> Table:
    engine = db.get_bind()
    meta = MetaData()
    return Table("accommodation_files", meta, autoload_with=engine)

# ------- Schemas -------
class FileLite(BaseModel):
    accommodation_file_id: Optional[int] = None
    house_id: int
    file_number: str
    house_no: Optional[str] = None
    sector: Optional[str] = None

class MovementOut(BaseModel):
    id: int
    file_number: Optional[str] = None
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
    remarks: Optional[str] = None

class ReceiveIn(BaseModel):
    movement_id: int
    remarks: Optional[str] = None

# ------- pagination -------
def paginate(q, page: int, per_page: int, db: Session):
    total = db.scalar(select(func.count()).select_from(q.subquery()))
    rows = db.execute(q.offset((page - 1) * per_page).limit(per_page)).all()
    return total, rows

# ------- Endpoints -------

@router.get("/files", response_model=List[FileLite])
def list_files(
    q: str = Query("", description="search by house file number"),
    db: Session = Depends(get_db),
    _user: Optional[User] = Depends(optional_user),  # auth-optional
):
    """Dropdown: read from houses.file_number; left join accommodation_files for label context."""
    af = _af_table(db)
    like = f"%{q}%"
    stmt = (
        select(
            af.c.id.label("accommodation_file_id"),
            House.id.label("house_id"),
            House.file_number.label("file_number") if hasattr(House, "file_number") else House.file_no.label("file_number"),
            House.house_no,
            House.sector,
        )
        .select_from(House.outerjoin(af, af.c.house_id == House.id))
        .where((House.file_number if hasattr(House, "file_number") else House.file_no).is_not(None))
        .where((House.file_number if hasattr(House, "file_number") else House.file_no).like(like))
        .order_by(House.id.desc())
        .limit(50)
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
def list_movements(
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=200),
    status: str = Query("open", pattern="^(open|all)$"),
    db: Session = Depends(get_db),
    _user: Optional[User] = Depends(optional_user),  # auth-optional
):
    """Latest movement per file_number; 'open' means latest is 'issue'."""
    latest = (
        select(FileMovement.file_number, func.max(FileMovement.moved_at).label("last_at"))
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
        .join(latest, and_(
            latest.c.file_number == FileMovement.file_number,
            latest.c.last_at == FileMovement.moved_at,
        ))
        .order_by(desc(FileMovement.moved_at))
    )
    if status == "open":
        base = base.where(FileMovement.movement == "issue")

    total, rows = paginate(base, page, per_page, db)
    items = [
        MovementOut(
            id=r.id,
            file_number=r.file_number,
            movement=r.movement,
            moved_at=r.moved_at.isoformat(),
            to_whom=r.to_whom,
            remarks=r.remarks,
        )
        for r in rows
    ]
    return Page(page=page, per_page=per_page, total=total, items=items)


@router.post("/issue", response_model=MovementOut)
def issue_file(
    payload: IssueIn,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(optional_user),  # auth-optional
):
    """Create 'issue' movement. If no accommodation_file exists for house, create one."""
    af = _af_table(db)
    house = db.get(House, payload.house_id)
    if not house:
        raise HTTPException(404, "House not found")

    # read file number from House (file_number vs file_no)
    file_num = getattr(house, "file_number", None) or getattr(house, "file_no", None)
    if not file_num:
        raise HTTPException(400, "This house has no file number")

    # find/create accommodation_file for this house
    existing = db.execute(select(af.c.id, af.c.file_no).where(af.c.house_id == house.id)).first()
    if existing:
        af_id = existing.id
        file_no = existing.file_no or file_num
    else:
        values = {"file_no": file_num, "house_id": house.id}
        if "opened_at" in af.c:
            values["opened_at"] = datetime.utcnow()
        af_id = db.execute(af.insert().values(**values)).inserted_primary_key[0]
        db.commit()
        file_no = file_num

    mv = FileMovement(
        accommodation_file_id=af_id,
        file_number=file_no,
        movement="issue",
        to_whom=payload.to_whom,
        remarks=payload.remarks,
        moved_by_user_id=getattr(user, "id", None),
    )
    db.add(mv); db.commit(); db.refresh(mv)

    return MovementOut(
        id=mv.id,
        file_number=mv.file_number,
        movement=mv.movement,
        moved_at=mv.moved_at.isoformat(),
        to_whom=mv.to_whom,
        remarks=mv.remarks,
    )


@router.post("/receive", response_model=MovementOut)
def receive_file(
    payload: ReceiveIn,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(optional_user),  # auth-optional
):
    """Close an open movement by cloning file_number and writing 'receive'."""
    open_mv = db.get(FileMovement, payload.movement_id)
    if not open_mv or open_mv.movement != "issue":
        raise HTTPException(404, "Open movement not found")

    mv2 = FileMovement(
        accommodation_file_id=getattr(open_mv, "accommodation_file_id", None),
        file_number=getattr(open_mv, "file_number", None),
        movement="receive",
        to_whom=None,
        remarks=payload.remarks,
        moved_by_user_id=getattr(user, "id", None),
    )
    db.add(mv2); db.commit(); db.refresh(mv2)

    return MovementOut(
        id=mv2.id,
        file_number=mv2.file_number,
        movement=mv2.movement,
        moved_at=mv2.moved_at.isoformat(),
        to_whom=mv2.to_whom,
        remarks=mv2.remarks,
    )
