# backend/app/routers/meta.py
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, asc
from pydantic import BaseModel

from ..deps import get_db, get_current_user, require_roles
from ..models.domain import Bps, Colony, Department, RoleEnum, User

router = APIRouter(prefix="/meta", tags=["Meta"])

# ---------- Schemas ----------
class BpsIn(BaseModel):
    grade: int

class BpsOut(BaseModel):
    id: int
    grade: int
    class Config:
        from_attributes = True

class ColonyIn(BaseModel):
    name: str
    address: Optional[str] = None

class ColonyOut(BaseModel):
    id: int
    name: str
    address: Optional[str] = None
    class Config:
        from_attributes = True

class DepartmentIn(BaseModel):
    name: str
    abbreviation: Optional[str] = None
    is_active: Optional[bool] = True

class DepartmentOut(BaseModel):
    id: int
    name: str
    abbreviation: Optional[str] = None
    is_active: bool
    class Config:
        from_attributes = True

# ---------- BPS ----------
@router.get("/bps", response_model=List[BpsOut])
def list_bps(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    stmt = select(Bps).order_by(asc(Bps.grade))
    return db.scalars(stmt).all()

@router.post("/bps", response_model=BpsOut)
def create_bps(payload: BpsIn, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleEnum.admin))):
    if db.scalar(select(Bps).where(Bps.grade == payload.grade)):
        raise HTTPException(400, "Grade already exists")
    row = Bps(grade=payload.grade)
    db.add(row); db.commit(); db.refresh(row)
    return row

@router.put("/bps/{bps_id}", response_model=BpsOut)
def update_bps(bps_id: int, payload: BpsIn, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleEnum.admin))):
    row = db.get(Bps, bps_id)
    if not row:
        raise HTTPException(404, "BPS not found")
    row.grade = payload.grade
    db.add(row); db.commit(); db.refresh(row)
    return row

@router.delete("/bps/{bps_id}")
def delete_bps(bps_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleEnum.admin))):
    row = db.get(Bps, bps_id)
    if not row:
        raise HTTPException(404, "BPS not found")
    db.delete(row); db.commit()
    return {"ok": True}

# ---------- Colony ----------
@router.get("/colonies", response_model=List[ColonyOut])
def list_colonies(q: Optional[str] = Query(default=None), db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    stmt = select(Colony)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(Colony.name.ilike(like))
    stmt = stmt.order_by(asc(Colony.name))
    return db.scalars(stmt).all()

@router.post("/colonies", response_model=ColonyOut)
def create_colony(payload: ColonyIn, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleEnum.admin, RoleEnum.operator))):
    if db.scalar(select(Colony).where(Colony.name == payload.name)):
        raise HTTPException(400, "Colony already exists")
    row = Colony(name=payload.name, address=payload.address)
    db.add(row); db.commit(); db.refresh(row)
    return row

@router.put("/colonies/{colony_id}", response_model=ColonyOut)
def update_colony(colony_id: int, payload: ColonyIn, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleEnum.admin, RoleEnum.operator))):
    row = db.get(Colony, colony_id)
    if not row:
        raise HTTPException(404, "Colony not found")
    row.name = payload.name
    row.address = payload.address
    db.add(row); db.commit(); db.refresh(row)
    return row

@router.delete("/colonies/{colony_id}")
def delete_colony(colony_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleEnum.admin))):
    row = db.get(Colony, colony_id)
    if not row:
        raise HTTPException(404, "Colony not found")
    db.delete(row); db.commit()
    return {"ok": True}

# ---------- Department ----------
@router.get("/departments", response_model=List[DepartmentOut])
def list_departments(
    q: Optional[str] = Query(default=None),
    active_only: bool = True,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(Department)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(Department.name.ilike(like))
    if active_only:
        stmt = stmt.where(Department.is_active.is_(True))
    stmt = stmt.order_by(asc(Department.name))
    return db.scalars(stmt).all()

@router.post("/departments", response_model=DepartmentOut)
def create_department(payload: DepartmentIn, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleEnum.admin, RoleEnum.operator))):
    if db.scalar(select(Department).where(Department.name == payload.name)):
        raise HTTPException(400, "Department already exists")
    row = Department(name=payload.name, abbreviation=payload.abbreviation, is_active=payload.is_active if payload.is_active is not None else True)
    db.add(row); db.commit(); db.refresh(row)
    return row

@router.put("/departments/{dept_id}", response_model=DepartmentOut)
def update_department(dept_id: int, payload: DepartmentIn, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleEnum.admin, RoleEnum.operator))):
    row = db.get(Department, dept_id)
    if not row:
        raise HTTPException(404, "Department not found")
    row.name = payload.name
    row.abbreviation = payload.abbreviation
    row.is_active = payload.is_active if payload.is_active is not None else row.is_active
    db.add(row); db.commit(); db.refresh(row)
    return row

@router.delete("/departments/{dept_id}")
def delete_department(dept_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleEnum.admin))):
    row = db.get(Department, dept_id)
    if not row:
        raise HTTPException(404, "Department not found")
    db.delete(row); db.commit()
    return {"ok": True}
