# app/models/user.py
from __future__ import annotations
from typing import Optional, List

from enum import Enum
from sqlalchemy import Integer, String, Boolean, Index, text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from .base import Base


class Role(str, Enum):
    admin = "admin"
    manager = "manager"
    viewer = "viewer"


class User(Base):
    __tablename__ = "user"
    __table_args__ = (
        # quick lookups
        Index("ix_user_username", "username", unique=True),
        Index("ix_user_email", "email", unique=True),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # identity
    username: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # auth (new schema)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("1"),  # SQLite-friendly
    )
    role: Mapped[str] = mapped_column(
        String,
        nullable=False,
        default=Role.viewer.value,
        server_default=text("'viewer'"),
    )
    permissions: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)

    # ---- legacy columns (kept to ease migration from old DB) ----
    # NOTE: don't write to these; they exist so old rows can be read/migrated.
    password: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    is_superuser: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("0"),
    )

    def __repr__(self) -> str:
        return f"<User username={self.username!r} role={self.role} active={self.is_active}>"
