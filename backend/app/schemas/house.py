from pydantic import BaseModel, Field, validator

ALLOWED_TYPES = set(list("ABCDEFGH"))
ALLOWED_STATUS = {"available","vacant","occupied","reserved","maintenance","other"}

class HouseBase(BaseModel):
    file_no: str = Field(..., max_length=64)
    qtr_no: int
    street: str
    sector: str
    type_code: str = Field(..., min_length=1, max_length=1, description="Type code A-H")
    status: str = Field("available", description="available, vacant, occupied, reserved, maintenance, other")

    @validator("type_code")
    def validate_type(cls, v):
        if v.upper() not in ALLOWED_TYPES:
            raise ValueError("type_code must be one of A-H")
        return v.upper()

    @validator("status")
    def normalize_status(cls, v):
        val = v.lower()
        if val not in ALLOWED_STATUS:
            return "other"
        return val

class HouseCreate(HouseBase):
    pass

class HouseUpdate(BaseModel):
    file_no: str | None = None
    qtr_no: int | None = None
    street: str | None = None
    sector: str | None = None
    type_code: str | None = None
    status: str | None = None

class HouseOut(HouseBase):
    id: int
    class Config:
        orm_mode = True
