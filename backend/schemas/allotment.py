from pydantic import BaseModel
from datetime import datetime

class AllotmentBase(BaseModel):
    person_name: str
    person_contact: str | None = None
    house_id: int
    notes: str | None = None

class AllotmentCreate(AllotmentBase):
    start_date: datetime | None = None

class AllotmentUpdate(BaseModel):
    end_date: datetime | None = None
    notes: str | None = None

class Allotment(AllotmentBase):
    id: int
    start_date: datetime
    end_date: datetime | None
    class Config:
        orm_mode = True
