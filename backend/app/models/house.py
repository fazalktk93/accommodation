from sqlalchemy import Column, Integer, String, DateTime, func
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class House(Base):
    __tablename__ = "houses"

    id = Column(Integer, primary_key=True, index=True)
    file_no = Column(String(120), unique=True, nullable=False, index=True)
    qtr_no  = Column(String(120), nullable=False)
    sector  = Column(String(120), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    allotments = relationship("Allotment", back_populates="house", cascade="all, delete-orphan")
