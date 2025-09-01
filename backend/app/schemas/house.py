from pydantic import BaseModel
from typing import Optional

class HouseBase(BaseModel):
    file_no: str
    qtr_no: str
    sector: str

class HouseCreate(HouseBase): pass

class HouseUpdate(BaseModel):
    file_no: Optional[str] = None
    qtr_no: Optional[str] = None
    sector: Optional[str] = None

class House(HouseBase):
    id: int
    class Config:
        orm_mode = True
