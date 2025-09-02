from datetime import date
from pydantic import BaseModel, Field
import re

CNIC_RE = re.compile(r"^\d{5}-\d{7}-\d{1}$|^\d{13}$")

class AllotmentBase(BaseModel):
    house_id: int
    person_name: str = Field(..., max_length=120)
    cnic: str | None = None
    start_date: date
    end_date: date | None = None
    active: bool | None = True
    notes: str | None = None

    @classmethod
    def validate_cnic(cls, v):
        if v and not CNIC_RE.match(v):
            raise ValueError("Invalid CNIC (use xxxxx-xxxxxxx-x or 13 digits)")
        return v

class AllotmentCreate(AllotmentBase):
    pass

class AllotmentOut(AllotmentBase):
    id: int
    class Config:
        orm_mode = True
