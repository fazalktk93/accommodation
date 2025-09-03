# backend/app/services/houses.py
from app.models.house import House, HouseStatus
from app.models.allotment import Allotment, QtrStatus
from sqlmodel import select

def _auto_status_from_allotments(session, house_id: int) -> HouseStatus:
    latest = session.exec(
        select(Allotment)
        .where(Allotment.house_id == house_id)
        .order_by(Allotment.id.desc())
        .limit(1)
    ).first()
    if not latest:
        return HouseStatus.vacant
    return HouseStatus.occupied if latest.qtr_status == QtrStatus.active else HouseStatus.vacant

def maybe_update_house_status(session, house_id: int):
    house = session.get(House, house_id)
    if not house or house.status_manual:
        return
    house.status = _auto_status_from_allotments(session, house_id)
    session.add(house)
