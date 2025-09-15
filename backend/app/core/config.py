# app/core/config.py
from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl
from typing import List
import os, pathlib, re

def _normalize_sqlite_url(url: str) -> str:
    if not url:
        return url
    if not url.startswith("sqlite"):
        # not sqlite, leave as-is
        return url

    # Replace backslashes with forward slashes
    url = url.replace("\\", "/")

    # Extract the path piece after sqlite://
    m = re.match(r"^sqlite:(//+)(.*)$", url)
    if not m:
        return url
    slashes, rest = m.groups()

    # If rest is a Windows drive path like E:/something.db,
    # ensure there are FOUR slashes after sqlite:
    if re.match(r"^[A-Za-z]:/", rest):
        return f"sqlite:////{rest}"

    # If it's relative, make it absolute to the backend folder
    p = pathlib.Path(rest)
    if not p.is_absolute():
        base = pathlib.Path(__file__).resolve().parents[2]  # ..../backend
        abs_path = (base / rest).resolve().as_posix()
        # absolute non-drive path (POSIX) is fine with three slashes
        return f"sqlite:///{abs_path}"

    # already absolute non-drive path (e.g., /var/tmp/app.db)
    return f"sqlite:///{p.as_posix()}"

class Settings(BaseSettings):
    PROJECT_NAME: str = "Accommodation"
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = []
    DATABASE_URL: str = ""

    # backwards-compat (some code/migrations might look for this)
    SQLALCHEMY_DATABASE_URL: str | None = None

    class Config:
        env_file = ".env"
        extra = "allow"

    @property
    def DB_URL(self) -> str:
        url = self.DATABASE_URL or (self.SQLALCHEMY_DATABASE_URL or "")
        # default if nothing provided
        if not url:
            url = "sqlite:///./accommodation.db"
        return _normalize_sqlite_url(url)

settings = Settings()
