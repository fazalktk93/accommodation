from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    database_url: str = "sqlite:///./dev.db"  # override in .env
    jwt_secret: str = "dev-secret"
    jwt_expires_min: int = 60
    cors_origins: List[str] = ["http://localhost:3000"]

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

settings = Settings()
