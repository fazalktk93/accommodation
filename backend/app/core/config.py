from functools import lru_cache
from typing import List, Optional, Union
from pydantic import BaseSettings, Field
import json
import os

class Settings(BaseSettings):
    # Keep your existing names so imports like "from app.core.config import settings" still work
    ENV: str = Field("production", description="environment: development/staging/production")
    API_PREFIX: str = "/api"
    SECRET_KEY: str = Field(..., description="JWT/crypto secret")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 10

    # IMPORTANT: your code references DATABASE_URL (db/session.py), so keep it
    DATABASE_URL: str = Field("sqlite:///./app.db", description="SQLAlchemy URL")

    # Be flexible: accept either a JSON array or comma-separated string for CORS
    BACKEND_CORS_ORIGINS: List[str] = []

    LOG_LEVEL: str = "INFO"
    CORS_ALLOW_CREDENTIALS: bool = True

    class Config:
        case_sensitive = True
        env_file = ".env"
        env_file_encoding = "utf-8"

# Parse CORS origins from env more flexibly while keeping the same attribute name
def _parse_cors(origins_env: Optional[str]) -> List[str]:
    if not origins_env:
        return []
    origins_env = origins_env.strip()
    # Try JSON first
    if origins_env.startswith("["):
        try:
            data = json.loads(origins_env)
            return [str(x) for x in data]
        except Exception:
            pass
    # Fallback: comma-separated
    return [o.strip() for o in origins_env.split(",") if o.strip()]

@lru_cache()
def _load_settings() -> Settings:
    s = Settings()
    # Normalize CORS if user provided env as string
    if isinstance(s.BACKEND_CORS_ORIGINS, str):
        s.BACKEND_CORS_ORIGINS = _parse_cors(s.BACKEND_CORS_ORIGINS)
    return s

# Export the same name your code already uses
settings: Settings = _load_settings()
