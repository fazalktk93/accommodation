from __future__ import annotations
from datetime import date
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.security import get_current_user, require_permissions  # ✅ added get_current_user
from app.api.deps import get_db
from app.schemas import allotment as s
from app.crud import allotment as crud
from app.crud import house as crud_house
from app.models import House, Allotment, QtrStatus
from app.models.user import Role  # ✅ fixed import
from app.schemas.allotment import AllotmentOutFull, AllotmentOutRestricted

router = APIRouter(prefix="/allotments", tags=["allotments"])


def _period(occ: date | None, vac: date | None) -> int | None:
    if not occ:
        return None
    end = vac or date.today()
    return (end - occ).days


@router.get("/", response_model=List[s.AllotmentOut])
def list_allotments(
    # accept `offset` from frontend but keep your internal name `skip`
    skip: int = Query(0, alias="offset", ge=0),
    limit: int = Query(5000, ge=1),
    house_id: Optional[int] = None,
    active: Optional[bool] = None,
    person_name: Optional[str] = None,
    file_no: Optional[str] = None,
    # qtr no is actually a string (e.g., "465-B")
    qtr_no: Optional[str] = None,
    # generic search term used by the UI — now applied in DB for cross-page results
    q: Optional[str] = Query(
        None,
        description=(
            "Generic search (name, cnic, file_no, qtr_no, sector, street, "
            "type_code, designation, directorate)"
        ),
    ),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),  # 👈 added (to know caller role)
):
    rows = crud.list(
        db,
        skip=skip,
        limit=limit,
        house_id=house_id,
        active=active,
        person_name=person_name,
        file_no=file_no,
        qtr_no=qtr_no,   # string!
        q=q,             # DB-side search
    )

    out: List[s.AllotmentOut] = []
    for a in rows:
        item = s.AllotmentOut.from_orm(a).copy(
            update={
                "period_of_stay": _period(a.occupation_date, a.vacation_date),
                "house_file_no": a.house.file_no if a.house else None,
                # house_qtr_no is a STRING now
                "house_qtr_no": a.house.qtr_no if a.house else None,
                "house_sector": a.house.sector if a.house else None,
                "house_street": a.house.street if a.house else None,
                "house_type_code": a.house.type_code if a.house else None,
            }
        )
        # 👇 Hide dob & dor for viewer role (only change you asked for)
        if user.role == Role.viewer.value:
            item = item.copy(update={"dob": None, "dor": None})
        out.append(item)

    return out


@router.get("/history/by-file/{file_no}", response_model=List[s.AllotmentOut])
def history_by_file(
    file_no: str,
    skip: int = Query(0, alias="offset", ge=0),
    limit: int = Query(5000, ge=1, le=50000),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),  # 👈 added so we can hide on history too
):
    house = crud_house.get_by_file(db, file_no)
    if not house:
        raise HTTPException(status_code=404, detail=f"House with file_no '{file_no}' not found")

    rows = crud.list(
        db,
        skip=skip,
        limit=limit,
        house_id=house.id,
        # frontend controls status filters
    )

    def to_out(a: Allotment) -> s.AllotmentOut:
        # ensure quarter number renders as string
        qtr_str = None
        if a.house:
            q = getattr(a.house, "qtr_no", None)
            qtr_str = None if q is None else str(q)

        item = s.AllotmentOut.from_orm(a).copy(update={
            "period_of_stay": _period(a.occupation_date, a.vacation_date),
            "house_file_no": house.file_no,
            "house_qtr_no": qtr_str,
        })
        if user.role == Role.viewer.value:
            item = item.copy(update={"dob": None, "dor": None})  # 👈 hide here as well
        return item

    return [to_out(a) for a in rows]


@router.get("/{allotment_id}", response_model=s.AllotmentOut)
def get_allotment(
    allotment_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),  # 👈 added (detail view also restricted)
):
    obj = crud.get(db, allotment_id)
    house = db.get(House, obj.house_id)
    item = s.AllotmentOut.from_orm(obj).copy(update={
        "period_of_stay": _period(obj.occupation_date, obj.vacation_date),
        "house_file_no": house.file_no if house else None,
        "house_qtr_no": house.qtr_no if house else None,
        "house_sector": house.sector if house else None,
        "house_street": house.street if house else None,
        "house_type_code": house.type_code if house else None,
    })
    # 👇 Hide dob & dor for viewer role
    if user.role == Role.viewer.value:
        item = item.copy(update={"dob": None, "dor": None})
    return item


@router.post("/", response_model=s.AllotmentOut, status_code=201)
def create_allotment(
    payload: s.AllotmentCreateFlexible,
    force_end_previous: bool = False,
    db: Session = Depends(get_db),
):
    # resolve house
    house_id = payload.house_id
    if not house_id and payload.house_file_no:
        h = db.query(House).filter(House.file_no == payload.house_file_no).first()
        if not h:
            raise HTTPException(status_code=422, detail="Unknown house_file_no")
        house_id = h.id
    if not house_id:
        raise HTTPException(status_code=422, detail="house_id or house_file_no is required")

    # determine qtr_status
    qtr_status = payload.qtr_status
    if qtr_status is None and payload.active is not None:
        qtr_status = QtrStatus.active if payload.active else QtrStatus.ended
    if qtr_status is None:
        qtr_status = QtrStatus.active

    create_data = s.AllotmentCreate(
        house_id=house_id,
        person_name=payload.person_name,
        designation=payload.designation,
        directorate=payload.directorate,
        cnic=payload.cnic,
        pool=payload.pool,
        medium=payload.medium,
        bps=payload.bps,
        allotment_date=payload.allotment_date,
        occupation_date=payload.occupation_date,
        vacation_date=payload.vacation_date,
        dob=payload.dob,
        dor=payload.dor,
        retention_until=payload.retention_until,
        retention_last=payload.retention_last,
        qtr_status=qtr_status,
        allottee_status=payload.allottee_status or s.AllotteeStatus.in_service,  # type: ignore[attr-defined]
        notes=payload.notes,
    )
    obj = crud.create(db, create_data, force_end_previous=force_end_previous)
    house = db.get(House, obj.house_id)
    return s.AllotmentOut.from_orm(obj).copy(update={
        "period_of_stay": _period(obj.occupation_date, obj.vacation_date),
        "house_file_no": house.file_no if house else None,
        "house_qtr_no": house.qtr_no if house else None,
    })


@router.patch("/{allotment_id}", response_model=s.AllotmentOut)
def update_allotment(
    allotment_id: int,
    payload: s.AllotmentUpdate,
    force_end_previous: bool = False,
    db: Session = Depends(get_db),
):
    obj = crud.update(db, allotment_id, payload, force_end_previous=force_end_previous)
    house = db.get(House, obj.house_id)
    return s.AllotmentOut.from_orm(obj).copy(update={
        "period_of_stay": _period(obj.occupation_date, obj.vacation_date),
        "house_file_no": house.file_no if house else None,
        "house_qtr_no": house.qtr_no if house else None,
    })


@router.post("/{allotment_id}/end", response_model=s.AllotmentOut)
def end_allotment(
    allotment_id: int,
    notes: Optional[str] = None,
    vacation_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    obj = crud.end(db, allotment_id, notes=notes, vacation_date=vacation_date)
    house = db.get(House, obj.house_id)
    return s.AllotmentOut.from_orm(obj).copy(update={
        "period_of_stay": _period(obj.occupation_date, obj.vacation_date),
        "house_file_no": house.file_no if house else None,
        "house_qtr_no": house.qtr_no if house else None,
    })


@router.delete("/{allotment_id}", status_code=204)
def delete_allotment(
    allotment_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_permissions('allotments:delete')),
):
    crud.delete(db, allotment_id)
    return None

# The following route is removed due to duplicate path conflict with the main list_allotments route above.
# If you need a restricted version, consider renaming the path or function.
