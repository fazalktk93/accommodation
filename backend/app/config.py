# backend/app/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import json
import os

def _parse_origins(val: str | List[str]) -> List[str]:
    if isinstance(val, list):
        return val
    s = (val or "").strip()
    if not s:
        return ["http://localhost:3000"]
    # Try JSON array first
    try:
        data = json.loads(s)
        if isinstance(data, list):
            return [str(x) for x in data]
    except Exception:
        pass
    # Fallback: comma-separated string
    return [x.strip() for x in s.split(",") if x.strip()]

class Settings(BaseSettings):
    # IMPORTANT: default to an absolute sqlite path so app & scripts use the same file
    database_url: str = os.getenv(
        "DATABASE_URL",
        "sqlite:////var/lib/accommodation/house_allotment.db"
    )
    jwt_secret: str = "dev-secret"
    jwt_expires_min: int = 60
    cors_origins: List[str] = ["http://localhost:3000"]

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    def __init__(self, **values):
        super().__init__(**values)
        # Normalize cors_origins if provided as a string
        if isinstance(self.cors_origins, str):
            self.cors_origins = _parse_origins(self.cors_origins)

settings = Settings()
