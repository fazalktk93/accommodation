from __future__ import annotations
from typing import Optional
from datetime import date
from sqlmodel import SQLModel, Field

class FileMovement(SQLModel, table=True):
    __tablename__ = "file_movement"

    id: Optional[int] = Field(default=None, primary_key=True)

    file_no: str = Field(index=True)
    subject: Optional[str] = None
    issued_to: Optional[str] = None
    department: Optional[str] = None

    issue_date: date = Field(default_factory=date.today)
    due_date: Optional[date] = None
    returned_date: Optional[date] = None

    remarks: Optional[str] = None
