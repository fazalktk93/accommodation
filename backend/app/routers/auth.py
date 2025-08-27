from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from ..deps import get_db, require_roles
from ..models.domain import User, RoleEnum
from ..schemas import LoginIn, Token, UserCreate, UserOut
from ..utils.security import verify_password, hash_password, create_access_token

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/login", response_model=Token)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(400, "Invalid email or password")
    token = create_access_token(sub=user.email)
    return {"access_token": token}

@router.post("/register", response_model=UserOut)
def register(payload: UserCreate, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleEnum.admin))):
    if db.scalar(select(User).where(User.email == payload.email)):
        raise HTTPException(400, "Email already in use")
    row = User(email=payload.email, password_hash=hash_password(payload.password), role=payload.role)
    db.add(row); db.commit(); db.refresh(row)
    return row
