from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, func, Text, Boolean
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class Allotment(Base):
    __tablename__ = "allotments"

    id = Column(Integer, primary_key=True, index=True)
    house_id = Column(Integer, ForeignKey("houses.id", ondelete="CASCADE"), nullable=False, index=True)
    house = relationship("House", back_populates="allotments")

    allottee_name = Column(String(160), nullable=False, index=True)
    designation  = Column(String(160), nullable=True)
    bps          = Column(Integer, nullable=True, index=True)
    directorate  = Column(String(160), nullable=True, index=True)
    cnic         = Column(String(25), nullable=True, index=True)

    allotment_date   = Column(Date, nullable=False, index=True)
    date_of_birth    = Column(Date, nullable=False, index=True)
    pool             = Column(String(80), nullable=True, index=True)
    qtr_status       = Column(String(80), nullable=True, index=True)
    accommodation_type = Column(String(120), nullable=True, index=True)
    occupation_date  = Column(Date, nullable=True, index=True)
    allotment_medium = Column(String(120), nullable=True)
    vacation_date    = Column(Date, nullable=True, index=True)

    superannuation_date = Column(Date, nullable=False, index=True)  # DOB + 60 years
    active = Column(Boolean, nullable=False, server_default="1", index=True)

    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    end_date   = Column(Date, nullable=True, index=True)
