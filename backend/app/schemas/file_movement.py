from typing import Optional
from datetime import date
from pydantic import BaseModel

class FileMovementCreate(BaseModel):
    file_no: str
    subject: Optional[str] = None
    issued_to: Optional[str] = None
    department: Optional[str] = None
    due_date: Optional[date] = None
    remarks: Optional[str] = None

class FileMovementUpdate(BaseModel):
    subject: Optional[str] = None
    issued_to: Optional[str] = None
    department: Optional[str] = None
    due_date: Optional[date] = None
    returned_date: Optional[date] = None
    remarks: Optional[str] = None

class FileMovementOut(BaseModel):
    id: int
    file_no: str
    subject: Optional[str] = None
    issued_to: Optional[str] = None
    department: Optional[str] = None
    issue_date: date
    due_date: Optional[date] = None
    returned_date: Optional[date] = None
    outstanding: bool = True
    remarks: Optional[str] = None

    class Config:
        orm_mode = True
