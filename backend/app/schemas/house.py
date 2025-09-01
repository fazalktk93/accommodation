from pydantic import BaseModel

class HouseBase(BaseModel):
    name: str
    address: str | None = None

class HouseCreate(HouseBase): pass

class HouseUpdate(BaseModel):
    name: str | None = None
    address: str | None = None

class House(HouseBase):
    id: int
    class Config:
        orm_mode = True
