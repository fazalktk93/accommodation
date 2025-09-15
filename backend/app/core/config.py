# app/core/config.py  (Pydantic v1 style)

import pathlib
import re
from typing import List, Optional

from pydantic import BaseSettings, AnyHttpUrl


def _normalize_sqlite_url(url: str) -> str:
    if not url or not url.startswith("sqlite"):
        return url

    # Replace backslashes for Windows safety
    url = url.replace("\\", "/")

    m = re.match(r"^sqlite:(//+)(.*)$", url)
    if not m:
        return url
    _, rest = m.groups()

    # Windows drive path (e.g., C:/path/file.db)
    if re.match(r"^[A-Za-z]:/", rest):
        return f"sqlite:////{rest}"

    # Relative path → make absolute relative to backend/
    p = pathlib.Path(rest)
    if not p.is_absolute():
        base = pathlib.Path(__file__).resolve().parents[2]  # .../backend
        abs_path = (base / rest).resolve().as_posix()
        return f"sqlite:///{abs_path}"

    # Already absolute POSIX path
    return f"sqlite:///{p.as_posix()}"


class Settings(BaseSettings):
    PROJECT_NAME: str = "Accommodation"
    API_PREFIX: str = "/api"

    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = []  # strict AnyHttpUrl list
    BACKEND_CORS_ORIGIN_REGEX: Optional[str] = None

    SECRET_KEY: str = ""

    DATABASE_URL: str = ""
    SQLALCHEMY_DATABASE_URL: Optional[str] = None

    class Config:
        env_file = ".env"
        extra = "allow"

    @property
    def DB_URL(self) -> str:
        url = self.DATABASE_URL or (self.SQLALCHEMY_DATABASE_URL or "")
        if not url:
            url = "sqlite:///./accommodation.db"
        return _normalize_sqlite_url(url)


settings = Settings()
