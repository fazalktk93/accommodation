# backend/app/api/routes/auth.py

from fastapi import APIRouter, Depends, HTTPException, status, Form, Response
from sqlalchemy.orm import Session
from sqlalchemy import select
import json

from app.core.security import verify_password, create_access_token, get_current_user
from app.db.session import get_session
from app.models.user import User
from app.schemas.user import Token, LoginRequest, UserRead
from app.core.config import settings
from app.core.session import create_session, COOKIE_NAME  # cookie sessions

# Mounted under /auth (and /api/auth via main.py)
router = APIRouter(prefix="/auth", tags=["auth"])


def get_db():
    """DB session dependency."""
    yield from get_session()


@router.get("/me", response_model=UserRead)
def whoami(user: User = Depends(get_current_user)):
    """JWT-protected 'who am I' endpoint (kept as-is)."""
    return user


# -------------------------------
# JWT / Bearer token endpoints
# -------------------------------

@router.post("/token", response_model=Token)
def login_for_access_token(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    JSON login:
    POST /auth/token
    Body: {"username": "...", "password": "..."}
    """
    user = db.scalar(select(User).where(User.username == payload.username))
    if not user or not user.is_active or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    # create_access_token expects the subject as a string
    token = create_access_token(user.username)
    return {"access_token": token, "token_type": "bearer"}


@router.post("/login", response_model=Token)
def login_alias(
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    """
    Form login:
    POST /auth/login
    Content-Type: application/x-www-form-urlencoded
    Body: username=...&password=...
    """
    user = db.scalar(select(User).where(User.username == username))
    if not user or not user.is_active or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    token = create_access_token(user.username)
    return {"access_token": token, "token_type": "bearer"}


@router.post("/jwt/login", response_model=Token)
def jwt_login_compat(
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    """
    Compatibility alias used by some frontends:
    POST /auth/jwt/login
    """
    user = db.scalar(select(User).where(User.username == username))
    if not user or not user.is_active or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    token = create_access_token(user.username)
    return {"access_token": token, "token_type": "bearer"}


# -------------------------------
# Cookie session endpoint (NEW)
# -------------------------------

@router.post("/cookie-login")
def cookie_login(
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    """
    Signed cookie session login (no JWT required by the client).
    Sets an HttpOnly cookie named 'session' signed with SECRET_KEY.
    """
    user = db.scalar(select(User).where(User.username == username))
    if not user or not user.is_active or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")

    # Create signed session from SECRET_KEY
    sess = create_session(user.username)
    payload = {"ok": True, "user": {"username": user.username}}
    response = Response(content=json.dumps(payload), media_type="application/json")

    # NOTE: set secure=True when serving over HTTPS
    response.set_cookie(
        key=COOKIE_NAME,
        value=sess,
        httponly=True,
        samesite="lax",
        secure=False,  # change to True in production behind HTTPS
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    return response
