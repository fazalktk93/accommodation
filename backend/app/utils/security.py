from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import jwt, JWTError
from ..config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)

def create_access_token(sub: str, expires_minutes: int | None = None) -> str:
    exp = datetime.utcnow() + timedelta(minutes=expires_minutes or settings.jwt_expires_min)
    to_encode = {"sub": sub, "exp": exp}
    return jwt.encode(to_encode, settings.jwt_secret, algorithm="HS256")

def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except JWTError:
        return None
