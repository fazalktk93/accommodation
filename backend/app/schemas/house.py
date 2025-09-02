from pydantic import BaseModel, Field

class HouseBase(BaseModel):
    file_no: str = Field(..., max_length=64)
    qtr_no: int
    sector: str

class HouseCreate(HouseBase):
    pass

class HouseUpdate(BaseModel):
    file_no: str | None = None
    qtr_no: int | None = None
    sector: str | None = None

class HouseOut(HouseBase):
    id: int
    class Config:
        orm_mode = True
