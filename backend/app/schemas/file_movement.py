from datetime import date, datetime
from pydantic import BaseModel
from app import models  # for type alias in /status endpoint

# Alias for typing in routes (avoids circular imports)
FileMovementModel = models.FileMovement

class FileIssueCreate(BaseModel):
    house_id: int | None = None
    file_no: str | None = None
    subject: str
    issued_to: str
    department: str | None = None
    due_date: date | None = None
    remarks: str | None = None

class FileReturn(BaseModel):
    remarks: str | None = None

class FileMovementOut(BaseModel):
    id: int
    house_id: int
    file_no: str
    subject: str
    issued_to: str
    department: str | None = None
    due_date: date | None = None
    remarks: str | None = None
    issue_date: datetime
    return_date: datetime | None = None

    class Config:
        orm_mode = True

class FileStatus(BaseModel):
    file_no: str
    status: str  # "available" | "issued"
    issued_to: str | None = None
    subject: str | None = None
