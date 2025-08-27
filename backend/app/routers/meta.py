from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from ..deps import get_db, require_roles
from ..models.domain import Bps, Colony, Department, RoleEnum
from ..schemas import BpsIn, BpsOut, ColonyIn, ColonyOut, DepartmentIn, DepartmentOut
from ..models.domain import User

router = APIRouter(prefix="/meta", tags=["Meta"])

@router.post("/bps", response_model=BpsOut)
def create_bps(payload: BpsIn, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleEnum.admin, RoleEnum.operator))):
    if db.scalar(select(Bps).where(Bps.code == payload.code)):
        raise HTTPException(400, "BPS code exists")
    row = Bps(**payload.model_dump()); db.add(row); db.commit(); db.refresh(row)
    return row

@router.get("/bps", response_model=list[BpsOut])
def list_bps(db: Session = Depends(get_db)):
    return db.scalars(select(Bps).order_by(Bps.rank.asc())).all()

@router.post("/colonies", response_model=ColonyOut)
def create_colony(payload: ColonyIn, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleEnum.admin, RoleEnum.operator))):
    row = Colony(**payload.model_dump()); db.add(row); db.commit(); db.refresh(row)
    return row

@router.get("/colonies", response_model=list[ColonyOut])
def list_colonies(db: Session = Depends(get_db)):
    return db.scalars(select(Colony).order_by(Colony.name.asc())).all()

@router.post("/departments", response_model=DepartmentOut)
def create_department(payload: DepartmentIn, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleEnum.admin, RoleEnum.operator))):
    if db.scalar(select(Department).where(Department.name == payload.name)):
        raise HTTPException(400, "Department exists")
    dep = Department(name=payload.name); db.add(dep); db.commit(); db.refresh(dep)
    return dep

@router.get("/departments", response_model=list[DepartmentOut])
def list_departments(db: Session = Depends(get_db)):
    return db.scalars(select(Department).order_by(Department.name)).all()
