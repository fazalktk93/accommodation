# backend/app/core/config.py
from pydantic import BaseSettings
from typing import List

class Settings(BaseSettings):
    ENV: str = "development"
    SQLALCHEMY_DATABASE_URL: str = "sqlite:///./accommodation.db"
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]
    LOG_LEVEL: str = "info"
    FORCE_POSTGRES: bool = False

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
