# backend/app/api/routes/users.py
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Path, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import get_session
from app.schemas.user import UserRead, UserCreate, UserUpdate  # ensure UserUpdate exists
from app.models.user import User, Role
from app.core.security import get_current_user, require_roles
from app.core.logging_config import audit_logger
from app.crud.user import create as create_user_crud
from app.crud.user import update as update_user_crud, get_by_username
from app.core.permissions import list_roles, catalog

router = APIRouter(prefix="/users", tags=["users"])

def get_db():
    yield from get_session()

# -----------------------------
# Helpers
# -----------------------------
def _role_value(role) -> str:
    # Accept Enum or plain string
    if hasattr(role, "value"):
        return role.value  # Enum
    return str(role) if role is not None else "viewer"

def _perm_list(perms) -> List[str]:
    # Normalize permissions to a list[str]
    if isinstance(perms, list):
        return [str(p) for p in perms if p is not None]
    return []

def _serialize_user(u: User) -> dict:
    return {
        "id": u.id,
        "username": u.username,
        "full_name": getattr(u, "full_name", None),
        "email": getattr(u, "email", None),
        "role": _role_value(getattr(u, "role", "viewer")),
        "permissions": _perm_list(getattr(u, "permissions", [])),
    }

# -----------------------------
# Create user
# -----------------------------
@router.post(
    "/",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    existing = db.scalar(select(User).where(User.username == payload.username))
    if existing:
        # 409 Conflict for duplicates
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")

    created = create_user_crud(db, payload)

    # Make sure odd DB defaults don't break response validation
    created.role = _role_value(created.role)
    created.permissions = _perm_list(created.permissions)

    try:
        audit_logger.emit(
            actor=actor.username,
            action="create",
            resource="user",
            resource_id=str(created.id),
            success=True,
        )
    except Exception:
        pass

    # Return a safe shape
    return _serialize_user(created)

# -----------------------------
# List users (with optional pagination)
# -----------------------------
@router.get(
    "/",
    response_model=List[UserRead],
    dependencies=[Depends(require_roles("admin", "manager"))],
)
def list_users(
    db: Session = Depends(get_db),
    offset: int = Query(0, ge=0),
    limit: int = Query(500, ge=1, le=5000),
):
    try:
        stmt = select(User).offset(offset).limit(limit)
        rows = db.scalars(stmt).all()
        return [_serialize_user(u) for u in rows]
    except Exception as e:
        # TEMP: surface details to help diagnose 500s during setup
        raise HTTPException(status_code=500, detail=f"/users list failed: {e}")

# -----------------------------
# Get single user
# -----------------------------
@router.get(
    "/{user_id}",
    response_model=UserRead,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
def get_user(
    user_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return _serialize_user(user)

# -----------------------------
# Update user
# If role changes, permissions auto-update from role (handled in CRUD)
# -----------------------------
@router.patch(
    "/{user_id}",
    response_model=UserRead,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
def update_user(
    user_id: int = Path(..., ge=1),
    payload: UserUpdate = ...,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Prevent username collisions if your schema allows username change
    if getattr(payload, "username", None) and payload.username != user.username:
        if get_by_username(db, payload.username):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")

    updated = update_user_crud(db, user, payload)

    try:
        audit_logger.emit(
            actor=actor.username,
            action="update",
            resource="user",
            resource_id=str(updated.id),
            success=True,
        )
    except Exception:
        pass

    return _serialize_user(updated)

# -----------------------------
# Role helpers for the frontend
# -----------------------------
@router.get(
    "/roles",
    summary="List allowable roles",
    dependencies=[Depends(require_roles("admin", "manager"))],
)
def list_user_roles():
    return {"roles": list_roles()}

@router.get(
    "/permission-catalog",
    summary="Optional: role -> effective permissions map",
    dependencies=[Depends(require_roles("admin", "manager"))],
)
def permission_catalog():
    return catalog()

@router.get("/me", response_model=UserRead)
def users_me(user: User = Depends(get_current_user)):
    return user