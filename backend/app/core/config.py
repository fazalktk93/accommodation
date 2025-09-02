from pydantic import BaseSettings
from typing import List

class Settings(BaseSettings):
    ENV: str = "development"
    SQLALCHEMY_DATABASE_URL: str = "sqlite:///./accommodation.db"
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        # keep 3000 if you also use it:
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    LOG_LEVEL: str = "info"
    FORCE_POSTGRES: bool = False

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
