from pydantic import BaseModel
from datetime import datetime

class FileMovementBase(BaseModel):
    file_code: str
    subject: str | None = None
    issued_to: str
    department: str | None = None
    due_date: datetime | None = None
    remarks: str | None = None

class FileIssueCreate(FileMovementBase): pass

class FileReturnUpdate(BaseModel):
    remarks: str | None = None

class FileMovement(FileMovementBase):
    id: int
    issue_date: datetime
    return_date: datetime | None
    class Config:
        orm_mode = True
