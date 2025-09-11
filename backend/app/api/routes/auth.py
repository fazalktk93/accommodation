# app/api/routes/auth.py
from fastapi import APIRouter, Depends, HTTPException, status, Form
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.security import verify_password, create_access_token, get_current_user
from app.db.session import get_session
from app.models.user import User
from app.schemas.user import Token, LoginRequest, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])

def get_db():
    yield from get_session()

@router.get("/me", response_model=UserRead)
def whoami(user: User = Depends(get_current_user)):
    return user

@router.post("/token", response_model=Token)
def login_for_access_token(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == payload.username))
    if not user or not user.is_active or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    token = create_access_token(sub=user.username)
    return {"access_token": token, "token_type": "bearer"}

@router.post("/login", response_model=Token)
def login_alias(
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    user = db.scalar(select(User).where(User.username == username))
    if not user or not user.is_active or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    token = create_access_token(sub=user.username)
    return {"access_token": token, "token_type": "bearer"}
