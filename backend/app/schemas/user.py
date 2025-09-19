# backend/app/schemas/user.py
from pydantic import BaseModel, validator
from typing import Optional, List

class UserCreate(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = "viewer"
    permissions: Optional[List[str]] = None  # ignored; role defines perms

    @validator("permissions", pre=True, always=True)
    def _ignore_permissions(cls, v):
        return []  # ignored, backend will compute


class UserRead(BaseModel):
    id: int
    username: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: str
    permissions: Optional[List[str]] = None

    class Config:
        orm_mode = True


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None
    role: Optional[str] = None
    permissions: Optional[List[str]] = None  # ignored

    @validator("permissions", pre=True)
    def _ignore_permissions_update(cls, v):
        return None  # ignored


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    username: str
    password: str
