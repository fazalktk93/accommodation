from pydantic import BaseModel, root_validator
from datetime import datetime
from typing import Optional

class FileMovementBase(BaseModel):
    house_id: Optional[int] = None
    file_no: Optional[str] = None
    subject: Optional[str] = None
    issued_to: str
    department: Optional[str] = None
    due_date: Optional[datetime] = None
    remarks: Optional[str] = None

    @root_validator
    def need_house_or_file(cls, values):
        if not values.get("house_id") and not values.get("file_no"):
            raise ValueError("Provide either house_id or file_no")
        return values

class FileIssueCreate(FileMovementBase): pass

class FileReturnUpdate(BaseModel):
    remarks: Optional[str] = None

class FileMovement(FileMovementBase):
    id: int
    issue_date: datetime
    return_date: Optional[datetime] = None
    class Config:
        orm_mode = True
