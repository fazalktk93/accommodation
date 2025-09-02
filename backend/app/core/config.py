from pydantic import BaseSettings, AnyHttpUrl
from typing import List

class Settings(BaseSettings):
    ENV: str = "development"

    # Default to Postgres (override in .env for your env)
    SQLALCHEMY_DATABASE_URL: str = (
        "postgresql+psycopg2://app:app@localhost:5432/accommodation"
    )

    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:5173"]
    LOG_LEVEL: str = "info"
    FORCE_POSTGRES: bool = True  # fail fast if we accidentally point to sqlite

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
