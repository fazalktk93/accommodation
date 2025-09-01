from pydantic import BaseSettings

class Settings(BaseSettings):
    ENV: str = "development"
    SQLALCHEMY_DATABASE_URI: str = "sqlite:///./accommodation.db"
    BACKEND_CORS_ORIGINS: str = "*"
    LOG_LEVEL: str = "info"

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
