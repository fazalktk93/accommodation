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
# Create user (kept as-is)
# -----------------------------
@router.post(
    "/",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(Role.admin, Role.manager))],
)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    existing = db.scalar(select(User).where(User.username == payload.username))
    if existing:
        # use 409 Conflict for duplicates
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")

    created = create_user_crud(db, payload)
    audit_logger.emit(
        actor=actor.username,
        action="create",
        resource="user",
        resource_id=str(created.id),
        success=True,
    )
    return created

# -----------------------------
# List users (now with optional pagination)
# -----------------------------
@router.get(
    "/",
    response_model=List[UserRead],
    dependencies=[Depends(require_roles(Role.admin, Role.manager))],
)
def list_users(
    db: Session = Depends(get_db),
    offset: int = Query(0, ge=0),
    limit: int = Query(500, ge=1, le=5000),
):
    stmt = select(User).offset(offset).limit(limit)
    return db.scalars(stmt).all()

# -----------------------------
# Get single user
# -----------------------------
@router.get(
    "/{user_id}",
    response_model=UserRead,
    dependencies=[Depends(require_roles(Role.admin, Role.manager))],
)
def get_user(
    user_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user

# -----------------------------
# Update user
# If role changes, permissions auto-update from role (no manual typing)
# -----------------------------
@router.patch(
    "/{user_id}",
    response_model=UserRead,
    dependencies=[Depends(require_roles(Role.admin, Role.manager))],
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

    # Prevent username collisions if you allow username update in schema
    if getattr(payload, "username", None) and payload.username != user.username:
        if get_by_username(db, payload.username):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")

    updated = update_user_crud(db, user, payload)
    audit_logger.emit(
        actor=actor.username,
        action="update",
        resource="user",
        resource_id=str(updated.id),
        success=True,
    )
    return updated

# -----------------------------
# Role helpers for the frontend (new)
# -----------------------------
@router.get(
    "/roles",
    summary="List allowable roles",
    dependencies=[Depends(require_roles(Role.admin, Role.manager))],
)
def list_user_roles():
    return {"roles": list_roles()}

@router.get(
    "/permission-catalog",
    summary="Optional: role -> effective permissions map",
    dependencies=[Depends(require_roles(Role.admin, Role.manager))],
)
def permission_catalog():
    return catalog()
