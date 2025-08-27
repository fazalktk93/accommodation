from sqlalchemy.orm import Session
from sqlalchemy import select, func
from datetime import datetime
from ..models.domain import Application, WaitingList, Bps, ApplicationStatus

def enqueue_application(db: Session, application_id: int) -> WaitingList:
    app = db.get(Application, application_id)
    if not app:
        raise ValueError("Application not found")
    bps = db.get(Bps, app.bps_id)
    base_priority = bps.rank * 10_000  # deterministic bucket by rank
    count_stmt = select(func.count(WaitingList.id)).select_from(WaitingList).join(Application).where(Application.bps_id == app.bps_id)
    count = db.scalar(count_stmt) or 0
    wl = WaitingList(application_id=application_id, priority=base_priority + count, created_at=datetime.utcnow())
    app.status = ApplicationStatus.approved
    db.add(wl)
    db.commit()
    db.refresh(wl)
    return wl
