from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select
from ..deps import get_db, require_roles
from ..models.domain import Employee, RoleEnum, User
from ..schemas import EmployeeIn, EmployeeOut

router = APIRouter(prefix="/employees", tags=["Employees"])

@router.post("", response_model=EmployeeOut)
def create_employee(payload: EmployeeIn, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleEnum.admin, RoleEnum.operator))):
    if db.scalar(select(Employee).where(Employee.nic == payload.nic)):
        raise HTTPException(400, "Employee with this NIC already exists")
    emp = Employee(**payload.model_dump()); db.add(emp); db.commit(); db.refresh(emp)
    return emp

@router.get("", response_model=list[EmployeeOut])
def search_employees(q: str | None = Query(default=None, description="Search by name or NIC"), db: Session = Depends(get_db)):
    stmt = select(Employee)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where((Employee.name.ilike(like)) | (Employee.nic.ilike(like)))
    return db.scalars(stmt.order_by(Employee.name)).all()
