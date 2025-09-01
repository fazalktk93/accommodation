from sqlalchemy import Column, Integer, String, DateTime, func, Text
from app.db.base_class import Base

class FileMovement(Base):
    __tablename__ = "file_movements"

    id = Column(Integer, primary_key=True, index=True)
    file_code = Column(String(120), nullable=False, index=True)
    subject = Column(String(255), nullable=True)
    issued_to = Column(String(120), nullable=False, index=True)
    department = Column(String(120), nullable=True)
    issue_date = Column(DateTime, server_default=func.now(), nullable=False, index=True)
    due_date = Column(DateTime, nullable=True)
    return_date = Column(DateTime, nullable=True, index=True)
    remarks = Column(Text, nullable=True)
