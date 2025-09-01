from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func, Text
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class Allotment(Base):
    __tablename__ = "allotments"

    id = Column(Integer, primary_key=True, index=True)
    person_name = Column(String(120), nullable=False, index=True)
    person_contact = Column(String(120), nullable=True)
    start_date = Column(DateTime, server_default=func.now(), nullable=False, index=True)
    end_date = Column(DateTime, nullable=True, index=True)
    notes = Column(Text, nullable=True)

    house_id = Column(Integer, ForeignKey("houses.id", ondelete="CASCADE"), nullable=False, index=True)
    house = relationship("House", back_populates="allotments")
