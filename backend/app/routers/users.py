from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from ..deps import get_db, get_current_user, require_roles
from ..models.domain import User, RoleEnum
from ..schemas import UserOut, UserCreate
from ..utils.security import hash_password

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user

@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_roles(RoleEnum.admin))):
    return db.scalars(select(User).order_by(User.id.desc())).all()

@router.post("", response_model=UserOut)
def create_user(payload: UserCreate, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleEnum.admin))):
    if db.scalar(select(User).where(User.email == payload.email)):
        raise HTTPException(400, "Email already used")
    row = User(email=payload.email, password_hash=hash_password(payload.password), role=payload.role)
    db.add(row); db.commit(); db.refresh(row)
    return row
