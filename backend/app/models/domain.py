from sqlalchemy import Column, Integer, String, ForeignKey, Date, DateTime, Enum, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship
from ..db import Base
import sqlalchemy as sa
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
    file_number = Column(String(50), nullable=True)
    house_no = Column(String(50), nullable=False)
    house_type = Column(String(50), nullable=True)
    street = Column(String(120), nullable=True)
    sector = Column(String(50), nullable=True)
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
# models/domain.py
class WaitingList(Base):
    __tablename__ = "waiting_list"
    id = sa.Column(sa.Integer, primary_key=True)
    employee_id = sa.Column(sa.Integer, sa.ForeignKey("employees.id"), nullable=False)
    colony_id   = sa.Column(sa.Integer, sa.ForeignKey("colonies.id"),  nullable=True)
    entitlement_date = sa.Column(sa.Date, nullable=False, index=True)  # DoE
    priority_points  = sa.Column(sa.Integer, default=0)
    status = sa.Column(sa.Enum("pending","allotted","withdrawn","skipped", name="waiting_status"),
                    default="pending", index=True)
    created_at = sa.Column(sa.DateTime, server_default=sa.func.now(), nullable=False)

    employee = sa.orm.relationship("Employee")
    colony   = sa.orm.relationship("Colony")

# helpful composite index
__table_args__ = (sa.Index("ix_wl_status_doe", "status", "entitlement_date"),)
# models/domain.py
class AccommodationFile(Base):
    __tablename__ = "accommodation_file"
    id = sa.Column(sa.Integer, primary_key=True)
    file_no = sa.Column(sa.String(64), nullable=False, unique=True, index=True)
    employee_id = sa.Column(sa.Integer, sa.ForeignKey("employees.id"), nullable=False)
    house_id    = sa.Column(sa.Integer, sa.ForeignKey("houses.id"),    nullable=True)
    opened_at   = sa.Column(sa.Date, nullable=False, server_default=sa.func.current_date())
    closed_at   = sa.Column(sa.Date, nullable=True)
    notes       = sa.Column(sa.Text, nullable=True)

    employee = sa.orm.relationship("Employee")
    house    = sa.orm.relationship("House")
# models/domain.py
class FileMovement(Base):
    __tablename__ = "file_movement"
    id = sa.Column(sa.Integer, primary_key=True)
    file_id   = sa.Column(sa.Integer, sa.ForeignKey("accommodation_file.id"), nullable=False)
    issued_to = sa.Column(sa.String(120), nullable=False)     # person/section
    issued_at = sa.Column(sa.DateTime, nullable=False, server_default=sa.func.now(), index=True)
    returned_at = sa.Column(sa.DateTime, nullable=True, index=True)
    remarks   = sa.Column(sa.Text, nullable=True)

    file = sa.orm.relationship("AccommodationFile")

    @property
    def is_out(self) -> bool:
        return self.returned_at is None
# models/domain.py
class Occupancy(Base):
    __tablename__ = "occupancy"
    id = sa.Column(sa.Integer, primary_key=True)
    house_id    = sa.Column(sa.Integer, sa.ForeignKey("houses.id"),    nullable=False)
    employee_id = sa.Column(sa.Integer, sa.ForeignKey("employees.id"), nullable=False)
    start_date  = sa.Column(sa.Date, nullable=False, index=True)
    end_date    = sa.Column(sa.Date, nullable=True, index=True)
    reason      = sa.Column(sa.String(120), nullable=True)  # allotted/transfer/vacated/etc.
    created_at  = sa.Column(sa.DateTime, server_default=sa.func.now(), nullable=False)

    house    = sa.orm.relationship("House")
    employee = sa.orm.relationship("Employee")

__table_args__ = (sa.Index("ix_occ_house_period", "house_id", "start_date", "end_date"),)
