# app/core/security.py
from datetime import datetime, timedelta
from typing import Optional, Iterable
import logging, functools, inspect, anyio
import jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy import select
from collections import defaultdict
from time import time

from app.core.config import settings
from app.db.session import get_session
from app.models.user import User, Role
from app.core.session import get_user_from_cookie

log = logging.getLogger("auth")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)

# -------------------------------
# Config / constants
# -------------------------------
ALGORITHM = "HS256"

def _require_secret() -> str:
    key = getattr(settings, "SECRET_KEY", None) or getattr(settings, "JWT_SECRET", None)
    if not key:
        log.critical("SECRET_KEY missing: set SECRET_KEY in .env")
        raise RuntimeError("SECRET_KEY not set. Add SECRET_KEY=... to .env")
    return key

def _get_exp_minutes() -> int:
    v = getattr(settings, "ACCESS_TOKEN_EXPIRE_MINUTES", 8 * 60)
    try:
        return int(v)
    except Exception:
        log.warning("ACCESS_TOKEN_EXPIRE_MINUTES=%r is not an int; defaulting to 480", v)
        return 8 * 60

# IMPORTANT: reflect the real mount (/api)
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_PREFIX}/auth/token",
    auto_error=False,
)

# -------------------------------
# Password helpers
# -------------------------------
def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

# -------------------------------
# JWT helpers
# -------------------------------
def create_access_token(sub: str, expires_delta: Optional[timedelta] = None) -> str:
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=_get_exp_minutes()))
    payload = {
        "sub": sub,
        "exp": expire,
        "iat": datetime.utcnow(),
        "jti": jwt.utils.base64url_encode(jwt.utils.force_bytes(sub + str(expire))).decode(),
        "iss": getattr(settings, "JWT_ISSUER", "accommodation.api"),
        "aud": getattr(settings, "JWT_AUDIENCE", "accommodation.frontend"),
    }
    return jwt.encode(payload, _require_secret(), algorithm=ALGORITHM)

# -------------------------------
# DB dependency
# -------------------------------
def get_db() -> Session:
    yield from get_session()

get_session_db = get_db  # alias for consistency

# -------------------------------
# Token extraction
# -------------------------------
ALLOW_QUERY_TOKENS = getattr(settings, "ALLOW_QUERY_TOKENS", False)

def _extract_token(request: Request, header_token: Optional[str]) -> Optional[str]:
    if header_token:
        return header_token
    # Bearer fallback
    auth = request.headers.get("authorization")
    if auth:
        parts = auth.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            return parts[1]
    # Custom headers
    for k in ("X-Auth-Token", "X-Api-Token"):
        v = request.headers.get(k)
        if v:
            log.warning("Using custom header %s for auth; migrate to Bearer", k)
            return v
    # Query params (optional)
    if ALLOW_QUERY_TOKENS:
        for k in ("access_token", "token"):
            v = request.query_params.get(k)
            if v:
                log.warning("Token via query param %s; consider disabling in production", k)
                return v
    return None

# -------------------------------
# Current user dependencies
# -------------------------------
def get_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    token = _extract_token(request, token)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(
            token,
            _require_secret(),
            algorithms=[ALGORITHM],
            options={"require": ["sub", "exp"], "verify_signature": True},
            audience=getattr(settings, "JWT_AUDIENCE", None),
            leeway=15,
        )
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
    setattr(request.state, "user", user)  # populate request.state.user
    return user

def get_current_user_cookie(
    request: Request,
    db: Session = Depends(get_session),
) -> User:
    username = get_user_from_cookie(request)
    user = db.scalar(select(User).where(User.username == username))
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive or missing user")
    setattr(request.state, "user", user)
    return user

# -------------------------------
# Role / Permission checks
# -------------------------------
def require_roles(*roles: Role):
    def _dep(user: User = Depends(get_current_user)) -> User:
        if user.role not in [r.value if hasattr(r, "value") else r for r in roles]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return user
    return _dep

# dependency-style permission check
def require_permissions_dep(*perms: str):
    def _dep(user: User = Depends(get_current_user)) -> User:
        user_perms = set(user.permissions or [])
        if not set(perms).issubset(user_perms):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Missing permission")
        return user
    return _dep

# decorator-style permission check
def _run_maybe_async(fn, *args, **kwargs):
    if inspect.iscoroutinefunction(fn):
        return fn(*args, **kwargs)
    return anyio.to_thread.run_sync(lambda: fn(*args, **kwargs))

def require_permissions(perms: Iterable[str]):
    perms_set = set(perms)
    def _decorator(fn):
        @functools.wraps(fn)
        async def wrapper(*args, **kwargs):
            request: Request = kwargs.get("request") or next((a for a in args if isinstance(a, Request)), None)
            if not request or not getattr(request.state, "user", None):
                raise HTTPException(status_code=401, detail="Not authenticated")
            user_perms = set(request.state.user.permissions or [])
            if not perms_set.issubset(user_perms):
                raise HTTPException(status_code=403, detail="Insufficient permissions")
            return await _run_maybe_async(fn, *args, **kwargs)
        return wrapper
    return _decorator

# keep alias so both forms are accessible
route_decorator_require_permissions = require_permissions

# -------------------------------
# Simple rate limit for login attempts
# -------------------------------
_LOGIN_FAILS = defaultdict(list)  # ip -> list[timestamp]

def too_many_failures(ip: str, window=900, max_n=10):
    now = time()
    events = [t for t in _LOGIN_FAILS[ip] if now - t < window]
    _LOGIN_FAILS[ip] = events
    return len(events) >= max_n

def record_failure(ip: str):
    _LOGIN_FAILS[ip].append(time())
