# routers/gwl.py
from backend.app.models.domain import WaitingList


@router.get("", response_model=list[GwlOut])
def list_wl(status: str = "pending", colony_id: int | None = None, db: Session = Depends(get_db)):
    stmt = select(WaitingList).where(WaitingList.status == status)
    if colony_id: stmt = stmt.where(WaitingList.colony_id == colony_id)
    stmt = stmt.order_by(WaitingList.entitlement_date.asc(),
                        WaitingList.priority_points.desc(), WaitingList.id.asc())
    return db.scalars(stmt).all()
