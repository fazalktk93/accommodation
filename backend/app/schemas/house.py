from typing import Optional
from pydantic import BaseModel

class HouseCreate(BaseModel):
    file_no: str
    qtr_no: Optional[int] = None
    street: Optional[str] = None
    sector: Optional[str] = None
    type_code: Optional[str] = None
    status: Optional[str] = "vacant"
    status_manual: Optional[bool] = False

class HouseUpdate(BaseModel):
    file_no: Optional[str] = None
    qtr_no: Optional[int] = None
    street: Optional[str] = None
    sector: Optional[str] = None
    type_code: Optional[str] = None
    status: Optional[str] = None
    status_manual: Optional[bool] = None

class HouseOut(BaseModel):
    id: int
    file_no: Optional[str] = None
    qtr_no: Optional[int] = None
    street: Optional[str] = None
    sector: Optional[str] = None
    type_code: Optional[str] = None
    status: Optional[str] = None
    status_manual: Optional[bool] = None

    class Config:
        orm_mode = True
