from typing import Optional, List
from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.file_movement import FileMovementCreate, FileMovementUpdate, FileMovementOut
from app.crud import file_movement as crud
from app.core.security import require_permissions

router = APIRouter(prefix="/files", tags=["files"])


@router.get("/", response_model=List[FileMovementOut])
def list_files(
    skip: int = Query(0, ge=0),
    limit: int = Query(500, ge=1, le=3000),   # hard-cap at 3000
    file_no: Optional[str] = None,
    outstanding: Optional[bool] = None,
    missing: Optional[bool] = None,
    db: Session = Depends(get_db),
    user=Depends(require_permissions("files:read")),
):
    rows = crud.list(
        db,
        skip=skip,
        limit=limit,
        file_no=file_no,
        outstanding=outstanding,
        missing=missing,
    )
    return [
        FileMovementOut.from_orm(r).copy(update={"outstanding": r.returned_date is None})
        for r in rows
    ]


@router.post("/", response_model=FileMovementOut, status_code=201)
def issue_file(
    payload: FileMovementCreate,
    db: Session = Depends(get_db),
    user=Depends(require_permissions("files:issue")),
):
    obj = crud.create(db, payload)
    return FileMovementOut.from_orm(obj).copy(update={"outstanding": obj.returned_date is None})


@router.get("/{file_id}", response_model=FileMovementOut)
def get_file(
    file_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_permissions("files:read")),
):
    obj = crud.get(db, file_id)
    return FileMovementOut.from_orm(obj).copy(update={"outstanding": obj.returned_date is None})


@router.patch("/{file_id}", response_model=FileMovementOut)
def update_file(
    file_id: int,
    payload: FileMovementUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_permissions("files:update")),
):
    obj = crud.update(db, file_id, payload)
    return FileMovementOut.from_orm(obj).copy(update={"outstanding": obj.returned_date is None})


@router.post("/{file_id}/return", response_model=FileMovementOut)
def return_file(
    file_id: int,
    returned_date: Optional[date] = None,
    db: Session = Depends(get_db),
    user=Depends(require_permissions("files:return")),
):
    obj = crud.mark_returned(db, file_id, returned_date)
    return FileMovementOut.from_orm(obj).copy(update={"outstanding": obj.returned_date is None})


@router.delete("/{file_id}", status_code=204)
def delete_file(
    file_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_permissions("files:delete")),
):
    crud.delete(db, file_id)
    return None
