# app/core/config.py  (Pydantic v1)

import pathlib
import re
from typing import List, Optional

from pydantic import BaseSettings, AnyHttpUrl


def _normalize_sqlite_url(url: Optional[str]) -> Optional[str]:
    """
    Normalize sqlite URLs so they are always valid & absolute on this machine.

    Accepts forms like:
      - sqlite:///./accommodation.db        (relative)
      - sqlite:////home/user/app/db.sqlite  (absolute)
      - sqlite:///home/user/app/db.sqlite   (absolute but 3 slashes)
      - sqlite:///:memory:                  (memory)
      - sqlite://home/user/app/db.sqlite    (bad: missing slash before 'home') -> fixed

    Returns a normalized URL, or the original value for non-sqlite schemes.
    """
    if not url or not url.startswith("sqlite"):
        return url

    # Tidy slashes (Windows safety)
    url = url.replace("\\", "/")

    # In-memory special cases
    if url in ("sqlite://", "sqlite:///:memory:", "sqlite:///:memory"):
        return "sqlite:///:memory:"

    m = re.match(r"^sqlite:(//+)(.*)$", url)
    if not m:
        # Unexpected format; leave as-is
        return url

    slashes, rest = m.groups()  # e.g., slashes="///", rest="/home/..", or "home/.."

    # Windows drive path (e.g., C:/path/file.db)
    if re.match(r"^[A-Za-z]:/", rest):
        # absolute drive paths should be 4 slashes after 'sqlite:'
        return f"sqlite:////{rest}"

    # If the path looks like a Linux absolute path but is missing the leading '/',
    # e.g., "home/user/..." (this creates the duplicate '/backend/home/...' bug),
    # then treat it as absolute by prepending '/'.
    if not rest.startswith("/") and re.match(r"^(home|var|etc|usr|opt|tmp|root|mnt|srv)/", rest):
        rest = "/" + rest

    p = pathlib.Path(rest)

    # Absolute path -> return canonical absolute sqlite URL (4 slashes after 'sqlite:')
    if p.is_absolute():
        return f"sqlite:///{p.as_posix()}"

    # Relative path -> make absolute relative to <repo>/backend
    base = pathlib.Path(__file__).resolve().parents[2]  # .../backend
    abs_path = (base / rest).resolve().as_posix()
    return f"sqlite:///{abs_path}"


class Settings(BaseSettings):
    PROJECT_NAME: str = "Accommodation"
    API_PREFIX: str = "/api"

    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = []
    BACKEND_CORS_ORIGIN_REGEX: Optional[str] = None

    SECRET_KEY: str = ""

    # Raw environment values (may be empty)
    DATABASE_URL: str = ""
    SQLALCHEMY_DATABASE_URL: Optional[str] = None

    class Config:
        env_file = ".env"
        extra = "allow"

    @property
    def DB_URL(self) -> str:
        # ENV first (so .env or process env wins), then DATABASE_URL, then a sane default
        raw = (self.SQLALCHEMY_DATABASE_URL
               or self.DATABASE_URL
               or "sqlite:///./accommodation.db")
        return _normalize_sqlite_url(raw)


settings = Settings()
