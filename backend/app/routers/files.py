# backend/app/routers/files.py
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select
from pydantic import BaseModel

from ..deps import get_db, get_current_user
from ..models.domain import AccommodationFile

router = APIRouter(prefix="/files", tags=["Accommodation Files"])

class FileOut(BaseModel):
    id: int
    file_no: str
    subject: Optional[str] = None  # keep optional in case your model has it

@router.get("", response_model=List[FileOut])
def list_files(
    q: Optional[str] = Query(None, description="search by file_no or subject"),
    db: Session = Depends(get_db),
    _: object = Depends(get_current_user),
):
    stmt = select(AccommodationFile)
    rows = db.scalars(stmt).all()

    out: List[FileOut] = []
    for f in rows:
        if q:
            # very simple filter; adjust to your fields
            subj = getattr(f, "subject", "") or ""
            if q.lower() not in f.file_no.lower() and q.lower() not in subj.lower():
                continue
        out.append(FileOut(id=f.id, file_no=f.file_no, subject=getattr(f, "subject", None)))
    return out
