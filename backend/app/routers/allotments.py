from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime
from ..deps import get_db, require_roles
from ..models.domain import Allotment, WaitingList, House, Application, ApplicationStatus, RoleEnum, User

router = APIRouter(prefix="/allotments", tags=["Allotments"])

@router.post("/assign/{waiting_id}")
def assign_house(waiting_id: int, house_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleEnum.admin))):
    wl = db.get(WaitingList, waiting_id)
    if not wl: raise HTTPException(404, "Waiting entry not found")
    house = db.get(House, house_id)
    if not house or house.status != "available": raise HTTPException(400, "House not available")
    allot = Allotment(application_id=wl.application_id, house_id=house_id, allotted_at=datetime.utcnow())
    app = db.get(Application, wl.application_id); app.status = ApplicationStatus.allotted
    house.status = "occupied"
    db.add(allot); db.delete(wl); db.commit()
    return {"ok": True, "allotment_id": allot.id}

@router.post("/release/{allotment_id}")
def release_house(allotment_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleEnum.admin))):
    allot = db.get(Allotment, allotment_id)
    if not allot: raise HTTPException(404, "Allotment not found")
    house = db.get(House, allot.house_id); house.status = "available"
    db.delete(allot); db.commit()
    return {"ok": True}
