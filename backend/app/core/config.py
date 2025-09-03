from typing import Optional
from pydantic import BaseSettings


class Settings(BaseSettings):
    ENV: str = "development"
    DATABASE_URL: str = "sqlite:///./accommodation.db"

    # Regex allows localhost and common LAN ranges (no hardcoded IPs)
    BACKEND_CORS_ORIGIN_REGEX: Optional[str] = (
        r"^https?://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|"
        r"172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$"
    )

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
