from __future__ import annotations
from typing import Optional, List
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Integer, String, Boolean
from sqlalchemy.types import JSON
from .base import Base
from enum import Enum

class Role(str, Enum):
    admin = "admin"
    manager = "manager"
    viewer = "viewer"

class User(Base):
    __tablename__ = "user"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String, unique=True, index=True)
    full_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    hashed_password: Mapped[str] = mapped_column(String)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    role: Mapped[str] = mapped_column(String, default=Role.viewer.value)
    permissions: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)
