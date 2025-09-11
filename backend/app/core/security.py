# backend/app/core/security.py
from datetime import datetime, timedelta
from typing import Optional
import jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.config import settings
from app.db.session import get_session
from app.models.user import User, Role

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Make docs happy; runtime doesn’t use this URL for validation.
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_PREFIX}/auth/token",
    auto_error=False,  # we’ll handle "no token" ourselves
)

# Use your configured app secret (not an ad-hoc default).
SECRET_KEY = getattr(settings, "SECRET_KEY", None) or getattr(settings, "JWT_SECRET", "change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_db() -> Session:
    yield from get_session()

def _extract_token(request: Request, header_token: Optional[str]) -> Optional[str]:
    # 1) OAuth2 header (already parsed if present)
    if header_token:
        return header_token

    # 2) Raw Authorization header (Bearer/JWT/Token)
    auth = request.headers.get("Authorization")
    if auth:
        parts = auth.split()
        if len(parts) == 2:
            return parts[1]

    # 3) Custom headers
    for k in ("X-Auth-Token", "X-Api-Token"):
        v = request.headers.get(k)
        if v:
            return v

    # 4) Query params
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
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub: str = payload.get("sub")
        if not sub:
            raise ValueError("No subject in token")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.scalar(select(User).where(User.username == sub))
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive or not found")
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
