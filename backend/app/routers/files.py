# backend/app/routers/files.py
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import select
from pydantic import BaseModel

from ..deps import get_db, get_current_user
from ..models.domain import AccommodationFile

router = APIRouter(prefix="/files", tags=["Accommodation Files"])

class FileOut(BaseModel):
    id: int
    file_no: str
    employee_id: int
    house_id: Optional[int] = None
    opened_at: str
    closed_at: Optional[str] = None
    # subject omitted since the page doesn't use it

@router.get("", response_model=List[FileOut])
def list_files(
    q: Optional[str] = Query(None, description="search by file_no"),
    file_no: Optional[str] = Query(None, description="exact file_no"),
    db: Session = Depends(get_db),
    _: object = Depends(get_current_user),
):
    stmt = select(AccommodationFile)
    rows = db.scalars(stmt).all()

    out: List[FileOut] = []
    for f in rows:
        # Optional filters
        if file_no and f.file_no != file_no:
            continue
        if q and q.lower() not in f.file_no.lower():
            continue

        out.append(FileOut(
            id=f.id,
            file_no=f.file_no,
            employee_id=f.employee_id,          # assumes these fields exist on your model
            house_id=getattr(f, "house_id", None),
            opened_at=f.opened_at.isoformat() if hasattr(f, "opened_at") and f.opened_at else "",
            closed_at=f.closed_at.isoformat() if hasattr(f, "closed_at") and f.closed_at else None,
        ))
    return out
