# backend/app/api/routes/auth.py

from fastapi import APIRouter, Depends, HTTPException, status, Form
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.security import verify_password, create_access_token
from app.db.session import get_session
from app.models.user import User
from app.schemas.user import Token, LoginRequest

# All routes below will be mounted under /auth (and optionally /api/auth in main.py)
router = APIRouter(prefix="/auth", tags=["auth"])

def get_db():
    # Reuse the project's session dependency
    yield from get_session()

@router.post("/token", response_model=Token)
def login_for_access_token(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    JSON login:
    POST /auth/token
    Body: {"username": "...", "password": "..."}
    """
    user = db.scalar(select(User).where(User.username == payload.username))
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    token = create_access_token({"sub": user.username})
    return {"access_token": token, "token_type": "bearer"}

@router.post("/login", response_model=Token)
def login_alias(
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    """
    Form login (useful for HTML forms):
    POST /auth/login
    Content-Type: application/x-www-form-urlencoded
    Body: username=...&password=...
    """
    user = db.scalar(select(User).where(User.username == username))
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    token = create_access_token({"sub": user.username})
    return {"access_token": token, "token_type": "bearer"}
