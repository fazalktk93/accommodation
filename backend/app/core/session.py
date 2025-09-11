# backend/app/core/session.py

from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from fastapi import Request, HTTPException, status
from app.core.config import settings

COOKIE_NAME = "session"

# Use the single SECRET_KEY from .env to sign sessions
_serializer = URLSafeTimedSerializer(settings.SECRET_KEY, salt="session")

def create_session(username: str) -> str:
    """Create a signed session string containing the username."""
    return _serializer.dumps({"sub": username})

def read_session(token: str) -> dict:
    """Validate and read the signed session."""
    try:
        return _serializer.loads(
            token,
            max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
    except SignatureExpired:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")
    except BadSignature:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")

def get_user_from_cookie(request: Request) -> str:
    """Extract username from the signed session cookie."""
    cookie = request.cookies.get(COOKIE_NAME)
    if not cookie:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    data = read_session(cookie)
    return data["sub"]
