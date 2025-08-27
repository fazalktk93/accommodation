from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import date, datetime
from enum import Enum

class RoleEnum(str, Enum):
    admin = "admin"
    operator = "operator"
    viewer = "viewer"

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: RoleEnum = RoleEnum.operator

class UserOut(BaseModel):
    id: int
    email: EmailStr
    role: RoleEnum
    is_active: bool
    class Config:
        from_attributes = True

class DepartmentIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)

class DepartmentOut(BaseModel):
    id: int
    name: str
    class Config:
        from_attributes = True

class BpsIn(BaseModel):
    code: str
    rank: int

class BpsOut(BpsIn):
    id: int
    class Config:
        from_attributes = True

class ColonyIn(BaseModel):
    name: str
    address: Optional[str] = None

class ColonyOut(ColonyIn):
    id: int
    class Config:
        from_attributes = True

class EmployeeIn(BaseModel):
    nic: str
    name: str
    department_id: Optional[int] = None
    directorate_id: Optional[int] = None
    designation_id: Optional[int] = None
    bps_id: Optional[int] = None
    date_of_joining: Optional[date] = None

class EmployeeOut(EmployeeIn):
    id: int
    class Config:
        from_attributes = True

class ApplicationIn(BaseModel):
    employee_id: int
    bps_id: int

class ApplicationOut(BaseModel):
    id: int
    employee_id: int
    bps_id: int
    status: str
    created_at: datetime
    class Config:
        from_attributes = True

class WaitingListOut(BaseModel):
    id: int
    application_id: int
    priority: int
    created_at: datetime
    class Config:
        from_attributes = True
