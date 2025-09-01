from sqlalchemy import Column, Integer, String, Text, DateTime, func
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class House(Base):
    __tablename__ = "houses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), unique=True, nullable=False, index=True)
    address = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    allotments = relationship("Allotment", back_populates="house", cascade="all, delete-orphan")
