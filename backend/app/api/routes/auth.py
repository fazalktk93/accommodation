# backend/app/api/routes/auth.py

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status, Form, Response, Request
from sqlalchemy.orm import Session
from sqlalchemy import select
import json
from app.core.session import create_session, COOKIE_NAME

from app.core.security import (
    verify_password,
    create_access_token,
    get_current_user,
    too_many_failures,
    record_failure,
)
from app.db.session import get_session
from app.models.user import User
from app.schemas.user import Token, UserRead
from app.core.config import settings
from app.core.session import create_session, COOKIE_NAME  # cookie sessions

# Mounted under /auth (and /api/auth via main.py)
router = APIRouter(prefix="/auth", tags=["auth"])

# -----------------------------------------------------------------------------
# Helper: DB session
# -----------------------------------------------------------------------------
def get_db():
    yield from get_session()

# -----------------------------------------------------------------------------
# POST /auth/token  -> JWT for tools/integrations
# -----------------------------------------------------------------------------
@router.post("/token", response_model=Token, summary="Password grant: return JWT")
def issue_token(
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
    request: Request = None,
):
    if too_many_failures(request.client.host if request else "0.0.0.0"):
        raise HTTPException(status_code=429, detail="Too many attempts. Try later.")

    user = db.scalar(select(User).where(User.username == username))
    if not user or not user.is_active or not verify_password(password, user.hashed_password):
        record_failure(request.client.host if request else "0.0.0.0")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect credentials")

    token = create_access_token(sub=user.username)
    return Token(access_token=token, token_type="bearer")

# -----------------------------------------------------------------------------
# POST /auth/login  -> set session cookie for browser use
# -----------------------------------------------------------------------------
@router.post(
    "/login",
    summary="Browser login: sets signed session cookie; also returns {'ok': True, user}",
)
async def login_form(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Accepts either JSON body {username, password} or
    form-encoded fields (username/password).
    Validates username/password from DB; requires active user.
    """
    # Accept json or form
    username = None
    password = None
    ctype = (request.headers.get("content-type") or "").lower()
    try:
        if "application/json" in ctype:
            body = await request.json()
            username = (body.get("username") or "").strip()
            password = body.get("password") or ""
        else:
            form = await request.form()
            username = (form.get("username") or "").strip()
            password = form.get("password") or ""
    except Exception:
        pass

    if not username or not password:
        raise HTTPException(status_code=400, detail="username/password required")

    user = db.scalar(select(User).where(User.username == username))
    if not user or not user.is_active or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect credentials")

    # Create signed cookie session
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
        max_age=getattr(settings, "ACCESS_TOKEN_EXPIRE_MINUTES", 60) * 60,
        path="/",
    )
    return response

# -----------------------------------------------------------------------------
# GET /auth/me  -> who am I (works with cookie or JWT)
# -----------------------------------------------------------------------------
@router.get("/me", response_model=UserRead, summary="Return current user")
def me(user: User = Depends(get_current_user)):
    return UserRead(
        id=user.id,
        username=user.username,
        role=getattr(user, "role", None),
        permissions=getattr(user, "permissions", []) or [],
        is_active=getattr(user, "is_active", True),
    )

# -----------------------------------------------------------------------------
# POST /auth/logout -> clear session cookie (browser)
# -----------------------------------------------------------------------------
@router.post("/logout", summary="Logout browser session (clears cookie)")
def logout():
    # Return a response that clears the cookie on the browser
    response = Response(content=json.dumps({"ok": True}), media_type="application/json")
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
    )
    return response

@router.post("/cookie-login", summary="Compat alias for /auth/login")
async def cookie_login_compat(request: Request, db: Session = Depends(get_db)):
    # simply reuse the main handler
    return await login_form(request=request, db=db)