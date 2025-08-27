from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime
from ..deps import get_db, require_roles
from ..models.domain import Application, ApplicationStatus, Employee, Bps, WaitingList, RoleEnum, User
from ..schemas import ApplicationIn, ApplicationOut, WaitingListOut
from ..services.waiting import enqueue_application

router = APIRouter(prefix="/applications", tags=["Applications & Waiting List"])

@router.post("", response_model=ApplicationOut)
def create_application(payload: ApplicationIn, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleEnum.admin, RoleEnum.operator))):
    if not db.get(Employee, payload.employee_id):
        raise HTTPException(404, "Employee not found")
    if not db.get(Bps, payload.bps_id):
        raise HTTPException(404, "BPS not found")
    app = Application(employee_id=payload.employee_id, bps_id=payload.bps_id, created_at=datetime.utcnow(), status=ApplicationStatus.pending)
    db.add(app); db.commit(); db.refresh(app)
    return app

@router.post("/{application_id}/approve", response_model=WaitingListOut)
def approve_application(application_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleEnum.admin))):
    app = db.get(Application, application_id)
    if not app: raise HTTPException(404, "Application not found")
    if app.status not in (ApplicationStatus.pending, ApplicationStatus.rejected):
        raise HTTPException(400, "Application cannot be approved in its current status")
    return enqueue_application(db, application_id)

@router.get("/waiting-list", response_model=list[WaitingListOut])
def list_waiting_list(db: Session = Depends(get_db)):
    stmt = select(WaitingList).order_by(WaitingList.priority.asc(), WaitingList.created_at.asc())
    return db.scalars(stmt).all()
