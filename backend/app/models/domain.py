from sqlalchemy import Column, Integer, String, Text, func, ForeignKey, Date, DateTime, Enum, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from ..db import Base
import sqlalchemy as sa
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
    role = Column(Enum(RoleEnum), default=RoleEnum.viewer, nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False)

class Colony(Base):
    __tablename__ = "colonies"
    id = Column(Integer, primary_key=True)
    name = Column(String(120), unique=True, nullable=False)
    address = Column(String(255))

class House(Base):
    __tablename__ = "houses"
    id = Column(Integer, primary_key=True, index=True)
    colony_id = Column(Integer, ForeignKey("colonies.id"), nullable=False, index=True)
    colony = relationship("Colony", backref="houses")
    quarter_no = Column(String(50), nullable=False, index=True)
    street = Column(String(120))
    sector = Column(String(120))
    type_letter = Column(String(1), nullable=False, index=True)  # A–H
    file_number = Column(String(120), nullable=True, unique=True)
    status = Column(String(20), nullable=False, default="available", index=True)  # available/occupied/...

class Bps(Base):
    __tablename__ = "bps"
    id = Column(Integer, primary_key=True)
    grade = Column(Integer, nullable=False, unique=True)

class Employee(Base):
    __tablename__ = "employees"
    id = Column(Integer, primary_key=True)
    name = Column(String(120), nullable=False)
    nic = Column(String(20), unique=True, nullable=False, index=True)
    department = Column(String(120))

class ApplicationStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    allotted = "allotted"

class Application(Base):
    __tablename__ = "applications"
    id = Column(Integer, primary_key=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False)
    bps_id = Column(Integer, ForeignKey("bps.id", ondelete="RESTRICT"), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    status = Column(Enum(ApplicationStatus), default=ApplicationStatus.pending, nullable=False, index=True)
    employee = relationship("Employee")
    bps = relationship("Bps")

class WaitingList(Base):
    __tablename__ = "waiting_lists"
    id = Column(Integer, primary_key=True)
    application_id = Column(Integer, ForeignKey("applications.id", ondelete="CASCADE"), unique=True, nullable=False)
    priority = Column(Integer, nullable=False)  # lower = earlier
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    application = relationship("Application")

class Allotment(Base):
    __tablename__ = "allotments"
    id = Column(Integer, primary_key=True)
    application_id = Column(Integer, ForeignKey("applications.id", ondelete="RESTRICT"), unique=True, nullable=False)
    house_id = Column(Integer, ForeignKey("houses.id", ondelete="RESTRICT"), nullable=False)
    allotted_at = Column(DateTime, server_default=func.now(), nullable=False)
    application = relationship("Application")
    house = relationship("House")

class Occupancy(Base):
    __tablename__ = "occupancy"
    id = Column(Integer, primary_key=True)
    house_id = Column(Integer, ForeignKey("houses.id"), nullable=False, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    start_date = Column(Date, nullable=False, index=True)
    end_date = Column(Date, index=True)
    reason = Column(String(120))
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    house = relationship("House")
    employee = relationship("Employee")

class FileMovement(Base):
    __tablename__ = "file_movements"
    id = Column(Integer, primary_key=True)
    house_id = Column(Integer, ForeignKey("houses.id"), nullable=True, index=True)
    file_number = Column(String, nullable=False, index=True)
    movement = Column(String, nullable=False)     # "issue" | "receive"
    to_whom = Column(String)
    remarks = Column(Text)
    moved_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)
    moved_by_user_id = Column(Integer, ForeignKey("users.id"))
    house = relationship("House")