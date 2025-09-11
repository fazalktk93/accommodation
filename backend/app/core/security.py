# app/core/security.py
from datetime import datetime, timedelta
from typing import Optional
import logging
import jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_session
from app.models.user import User

log = logging.getLogger("auth")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Use a single, stable secret/algorithm everywhere
SECRET_KEY = getattr(settings, "SECRET_KEY", None) or getattr(settings, "JWT_SECRET", None)
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY not set; add SECRET_KEY=... to your .env")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = getattr(settings, "ACCESS_TOKEN_EXPIRE_MINUTES", 8 * 60)

# Do not auto-error; we’ll handle "no token" gracefully
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token", auto_error=False)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(sub: str, expires_delta: Optional[timedelta] = None) -> str:
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    payload = {"sub": sub, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def _extract_token(request: Request, header_token: Optional[str]) -> Optional[str]:
    # 1) Provided by OAuth2PasswordBearer
    if header_token:
        return header_token
    # 2) Raw Authorization header
    auth = request.headers.get("authorization")
    if auth:
        parts = auth.split()
        if len(parts) == 2:
            return parts[1]
    # 3) Custom headers
    for k in ("X-Auth-Token", "X-Api-Token"):
        v = request.headers.get(k)
        if v:
            return v
    # 4) Query params (as a last resort)
    for k in ("access_token", "token"):
        v = request.query_params.get(k)
        if v:
            return v
    return None

def get_db() -> Session:
    yield from get_session()

def get_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    token = _extract_token(request, token)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if not sub:
            log.error("JWT missing 'sub' claim: %r", payload)
            raise HTTPException(status_code=401, detail="Invalid token payload")
    except jwt.ExpiredSignatureError:
        log.warning("JWT expired")
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidSignatureError:
        log.error("JWT invalid signature — check SECRET_KEY")
        raise HTTPException(status_code=401, detail="Invalid token signature")
    except Exception as e:
        log.exception("JWT decode failed: %s", e)
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.scalar(select(User).where(User.username == sub))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User inactive or not found")
    return user
