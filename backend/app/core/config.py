# app/core/config.py (add/ensure these exist)
from pydantic import BaseSettings, Field
from functools import lru_cache
import json, os
from typing import List, Optional

class Settings(BaseSettings):
    ENV: str = Field("production")
    API_PREFIX: str = "/api"
    SECRET_KEY: str = Field(..., description="JWT secret")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 10

    # Accept both names, prefer DATABASE_URL
    DATABASE_URL: str = Field("sqlite:///./accommodation.db", env="DATABASE_URL")
    SQLALCHEMY_DATABASE_URL: Optional[str] = Field(None, env="SQLALCHEMY_DATABASE_URL")

    BACKEND_CORS_ORIGINS: List[str] | str = Field(default_factory=list)
    BACKEND_CORS_ORIGIN_REGEX: Optional[str] = None

    class Config:
        case_sensitive = True
        env_file = ".env"

@lru_cache()
def _load_settings() -> Settings:
    s = Settings()
    # Map legacy SQLALCHEMY_DATABASE_URL → DATABASE_URL if provided
    if s.SQLALCHEMY_DATABASE_URL and not s.DATABASE_URL:
        s.DATABASE_URL = s.SQLALCHEMY_DATABASE_URL

    # Normalize CORS env if it was JSON/string
    if isinstance(s.BACKEND_CORS_ORIGINS, str):
        try:
            s.BACKEND_CORS_ORIGINS = json.loads(s.BACKEND_CORS_ORIGINS)
        except Exception:
            s.BACKEND_CORS_ORIGINS = [o.strip() for o in s.BACKEND_CORS_ORIGINS.split(",") if o.strip()]
    return s

settings = _load_settings()
