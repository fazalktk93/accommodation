from sqlalchemy import Column, Integer, String, ForeignKey, Date, DateTime, Enum, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship
from ..db import Base
import enum

class RoleEnum(str, enum.Enum):
    admin = "admin"
    operator = "operator"
    viewer = "viewer"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(RoleEnum), nullable=False, default=RoleEnum.operator)
    is_active = Column(Boolean, default=True)

class Department(Base):
    __tablename__ = "departments"
    id = Column(Integer, primary_key=True)
    name = Column(String(120), unique=True, nullable=False)

class Directorate(Base):
    __tablename__ = "directorates"
    id = Column(Integer, primary_key=True)
    name = Column(String(120), unique=True, nullable=False)

class Designation(Base):
    __tablename__ = "designations"
    id = Column(Integer, primary_key=True)
    name = Column(String(120), unique=True, nullable=False)

class Bps(Base):
    __tablename__ = "bps"
    id = Column(Integer, primary_key=True)
    code = Column(String(10), unique=True, nullable=False)  # e.g., BPS-17
    rank = Column(Integer, nullable=False)  # numeric level for ordering

class Colony(Base):
    __tablename__ = "colonies"
    id = Column(Integer, primary_key=True)
    name = Column(String(120), unique=True, nullable=False)
    address = Column(String(255), nullable=True)

class House(Base):
    __tablename__ = "houses"
    id = Column(Integer, primary_key=True)
    colony_id = Column(Integer, ForeignKey("colonies.id", ondelete="RESTRICT"), nullable=False)
    house_no = Column(String(50), nullable=False)
    house_type = Column(String(50), nullable=True)
    status = Column(String(20), nullable=False, default="available")  # available/occupied/maintenance
    colony = relationship("Colony")
    __table_args__ = (UniqueConstraint("colony_id", "house_no", name="uq_colony_house"),)

class Employee(Base):
    __tablename__ = "employees"
    id = Column(Integer, primary_key=True)
    nic = Column(String(20), unique=True, nullable=False)  # CNIC
    name = Column(String(120), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"))
    directorate_id = Column(Integer, ForeignKey("directorates.id", ondelete="SET NULL"))
    designation_id = Column(Integer, ForeignKey("designations.id", ondelete="SET NULL"))
    bps_id = Column(Integer, ForeignKey("bps.id", ondelete="SET NULL"))
    date_of_joining = Column(Date, nullable=True)

class ApplicationStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    allotted = "allotted"

class Application(Base):
    __tablename__ = "applications"
    id = Column(Integer, primary_key=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    bps_id = Column(Integer, ForeignKey("bps.id", ondelete="RESTRICT"), nullable=False)
    created_at = Column(DateTime, nullable=False)
    status = Column(Enum(ApplicationStatus), default=ApplicationStatus.pending, nullable=False)
    employee = relationship("Employee")
    bps = relationship("Bps")

class WaitingList(Base):
    __tablename__ = "waiting_lists"
    id = Column(Integer, primary_key=True)
    application_id = Column(Integer, ForeignKey("applications.id", ondelete="CASCADE"), unique=True, nullable=False)
    priority = Column(Integer, nullable=False)  # lower means earlier
    created_at = Column(DateTime, nullable=False)
    application = relationship("Application")

class Allotment(Base):
    __tablename__ = "allotments"
    id = Column(Integer, primary_key=True)
    application_id = Column(Integer, ForeignKey("applications.id", ondelete="RESTRICT"), unique=True, nullable=False)
    house_id = Column(Integer, ForeignKey("houses.id", ondelete="RESTRICT"), nullable=False)
    allotted_at = Column(DateTime, nullable=False)
    application = relationship("Application")
    house = relationship("House")
