# backend/app/api/routes/auth.py

from __future__ import annotations

import json
from fastapi import APIRouter, Depends, HTTPException, status, Form, Response, Request
from sqlalchemy.orm import Session
from sqlalchemy import select

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

router = APIRouter(prefix="/auth", tags=["auth"])

# -------------------------- DB helper ----------------------------------------
def get_db():
    yield from get_session()

# -------------------------- JWT for tools (kept) -----------------------------
@router.post("/token", response_model=Token, summary="Password grant: return JWT")
def issue_token(
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
    request: Request = None,
):
    if request and too_many_failures(request.client.host):
        raise HTTPException(status_code=429, detail="Too many attempts. Try later.")

    user = db.scalar(select(User).where(User.username == username))
    if not user or not user.is_active or not verify_password(password, user.hashed_password):
        if request:
            record_failure(request.client.host)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect credentials")

    token = create_access_token(sub=user.username)
    return Token(access_token=token, token_type="bearer")

# -------------------------- Browser login (COOKIE) ---------------------------
@router.post(
    "/login",
    summary="Browser login: sets signed session cookie; returns {'ok': True, user}",
)
async def login_form(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Accepts JSON {username,password} or x-www-form-urlencoded.
    Sets HttpOnly cookie 'session' (dev: secure=False; prod: True).
    """
    ctype = (request.headers.get("content-type") or "").lower()
    username = password = None

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
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")

    # Make signed cookie session
    sess = create_session(user.username)
    max_age = int(getattr(settings, "ACCESS_TOKEN_EXPIRE_MINUTES", 60)) * 60

    payload = {"ok": True, "user": {"username": user.username}}
    response = Response(content=json.dumps(payload), media_type="application/json")
    response.set_cookie(
        key=COOKIE_NAME,
        value=sess,
        httponly=True,
        samesite="lax",
        secure=False,  # flip to True in HTTPS production
        max_age=max_age,
        path="/",
    )
    return response

# Back-compat alias: support old callers hitting /auth/cookie-login
@router.post("/cookie-login", summary="Compat alias for /auth/login")
async def cookie_login_compat(request: Request, db: Session = Depends(get_db)):
    return await login_form(request=request, db=db)

# -------------------------- Who am I (cookie or JWT) -------------------------
@router.get("/me", response_model=UserRead, summary="Return current user")
def me(user: User = Depends(get_current_user)):
    return UserRead(
        id=user.id,
        username=user.username,
        role=getattr(user, "role", None),
        permissions=getattr(user, "permissions", []) or [],
        is_active=getattr(user, "is_active", True),
    )

# -------------------------- Logout (clear cookie) ----------------------------
@router.post("/logout", summary="Logout browser session (clears cookie)")
def logout():
    response = Response(content=json.dumps({"ok": True}), media_type="application/json")
    response.delete_cookie(key=COOKIE_NAME, path="/")
    return response
