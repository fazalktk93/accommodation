# app/core/security.py
from datetime import datetime, timedelta
from typing import Optional
import logging
import jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.config import settings
from app.db.session import get_session
from app.models.user import User, Role

log = logging.getLogger("auth")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Use ONE stable secret everywhere
SECRET_KEY = getattr(settings, "SECRET_KEY", None) or getattr(settings, "JWT_SECRET", None)
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY not set. Add SECRET_KEY=... to .env")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = getattr(settings, "ACCESS_TOKEN_EXPIRE_MINUTES", 8 * 60)

# IMPORTANT: reflect the real mount (/api)
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_PREFIX}/auth/token",
    auto_error=False,
)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(sub: str, expires_delta: Optional[timedelta] = None) -> str:
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    payload = {"sub": sub, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def get_db() -> Session:
    yield from get_session()

def _extract_token(request: Request, header_token: Optional[str]) -> Optional[str]:
    # 1) Parsed by OAuth2PasswordBearer
    if header_token:
        return header_token
    # 2) Raw Authorization
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
    # 4) Query params fallback
    for k in ("access_token", "token"):
        v = request.query_params.get(k)
        if v:
            return v
    return None

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
            log.error("JWT missing 'sub': %r", payload)
            raise HTTPException(status_code=401, detail="Invalid token payload")
    except jwt.ExpiredSignatureError:
        log.warning("JWT expired")
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidSignatureError:
        log.error("JWT invalid signature (wrong SECRET_KEY?)")
        raise HTTPException(status_code=401, detail="Invalid token signature")
    except Exception as e:
        log.exception("JWT decode failed: %s", e)
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.scalar(select(User).where(User.username == sub))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User inactive or not found")
    return user

def require_roles(*roles: Role):
    def _dep(user: User = Depends(get_current_user)) -> User:
        if user.role not in [r.value if hasattr(r, "value") else r for r in roles]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return user
    return _dep

def require_permissions(*perms: str):
    def _dep(user: User = Depends(get_current_user)) -> User:
        user_perms = set(user.permissions or [])
        if not set(perms).issubset(user_perms):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Missing permission")
        return user
    return _dep

# -------------------------------
# Cookie-session auth dependency
# -------------------------------
from app.core.session import get_user_from_cookie

def get_current_user_cookie(
    request: Request,
    db: Session = Depends(get_session),
) -> User:
    """
    Authenticate using signed cookie session (created by /auth/cookie-login).
    Keeps existing JWT-based get_current_user untouched.
    """
    username = get_user_from_cookie(request)
    user = db.scalar(select(User).where(User.username == username))
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive or missing user")
    return user
