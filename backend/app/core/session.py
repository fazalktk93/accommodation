# backend/app/core/session.py

import base64
import hashlib
import hmac
import json
import time
from fastapi import Request, HTTPException, status
from app.core.config import settings

# Cookie name used across the app
COOKIE_NAME = "session"

# IMPORTANT: set SECRET_KEY in .env in production!
_SECRET = getattr(settings, "SECRET_KEY", None) or "CHANGE_ME_DEV_ONLY"

def _sign(b: bytes) -> str:
    mac = hmac.new(_SECRET.encode(), b, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(mac).decode().rstrip("=")

def create_session(username: str, ttl_seconds: int = 60 * 60 * 12) -> str:
    """
    Make a signed, expiring session value for an HttpOnly cookie.
    """
    payload = {"u": username, "exp": int(time.time()) + ttl_seconds}
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    sig = _sign(raw)
    return base64.urlsafe_b64encode(raw).decode().rstrip("=") + "." + sig

def get_user_from_cookie(request: Request) -> str:
    """
    Read and validate the cookie. Return username or raise 401.
    """
    v = request.cookies.get(COOKIE_NAME)
    if not v:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No session")
    try:
        body_b64, sig = v.split(".", 1)
        pad = "=" * (-len(body_b64) % 4)
        body = base64.urlsafe_b64decode(body_b64 + pad)
        if _sign(body) != sig:
            raise ValueError("bad signature")
        data = json.loads(body)
        if int(time.time()) > int(data["exp"]):
            raise ValueError("expired")
        return data["u"]
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
