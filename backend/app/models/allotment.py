from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, func, Text, Boolean
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class Allotment(Base):
    __tablename__ = "allotments"

    id = Column(Integer, primary_key=True, index=True)

    # linkage
    house_id = Column(Integer, ForeignKey("houses.id", ondelete="CASCADE"), nullable=False, index=True)
    house = relationship("House", back_populates="allotments")

    # your required fields
    allottee_name = Column(String(160), nullable=False, index=True)      # Allottee Name
    designation  = Column(String(160), nullable=True)                    # Designation
    bps          = Column(Integer, nullable=True, index=True)            # BPS
    directorate  = Column(String(160), nullable=True, index=True)        # Directorate
    cnic         = Column(String(25), nullable=True, index=True)         # CNIC (XXXXX-XXXXXXX-X)
    allotment_date   = Column(Date, nullable=False, index=True)          # Allotment Date
    date_of_birth    = Column(Date, nullable=False, index=True)          # Date of Birth
    pool             = Column(String(80), nullable=True, index=True)     # Pool
    qtr_status       = Column(String(80), nullable=True, index=True)     # Qtr Status
    accommodation_type = Column(String(120), nullable=True, index=True)  # Accommodation type
    occupation_date  = Column(Date, nullable=True, index=True)           # Occupation Date
    allotment_medium = Column(String(120), nullable=True)                # Allotment Medium
    vacation_date    = Column(Date, nullable=True, index=True)           # Vacation Date

    # computed / system-managed
    superannuation_date = Column(Date, nullable=False, index=True)       # DOB + 60 years (computed)
    active = Column(Boolean, nullable=False, server_default="1", index=True)

    # audit-ish
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    end_date   = Column(Date, nullable=True, index=True)  # if vacated or ended
