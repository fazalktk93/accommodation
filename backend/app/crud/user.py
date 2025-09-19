# app/crud/user.py
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate  # UserUpdate optional but handy
from app.core.security import get_password_hash
from app.core.permissions import defaults_for_role, list_roles


def get_by_username(db: Session, username: str) -> User | None:
    return db.scalar(select(User).where(User.username == username))


def create(db: Session, payload: UserCreate) -> User:
    """
    Create a user where effective permissions come strictly from the selected role.
    Accepted roles: 'admin' | 'manager' | 'viewer'
    Any permissions provided in payload.permissions are ignored on purpose.
    """
    role = (payload.role or "viewer").lower()
    if role not in list_roles():
        role = "viewer"  # fallback safely

    effective_perms = defaults_for_role(role)

    user = User(
        username=payload.username,
        full_name=payload.full_name,
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        role=role,
        permissions=effective_perms,
        is_active=getattr(payload, "is_active", True),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# OPTIONAL: add this to keep updates consistent with the new role-only flow.
def update(db: Session, user: User, payload: UserUpdate) -> User:
    """
    Update user fields. If role changes, recompute permissions from role.
    permissions in the payload are ignored (role is the source of truth).
    """
    # basic fields (only set when provided)
    if getattr(payload, "full_name", None) is not None:
        user.full_name = payload.full_name
    if getattr(payload, "email", None) is not None:
        user.email = payload.email
    if getattr(payload, "is_active", None) is not None:
        user.is_active = payload.is_active

    # role → permissions
    if getattr(payload, "role", None):
        role = (payload.role or "viewer").lower()
        if role not in list_roles():
            role = "viewer"
        user.role = role
        user.permissions = defaults_for_role(role)

    db.add(user)
    db.commit()
    db.refresh(user)
    return user
