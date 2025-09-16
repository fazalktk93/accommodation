# app/core/config.py  (keep the rest of your file; just replace the normalizer)

import pathlib
import re
import json
from typing import List, Optional, Any
from pydantic import BaseSettings, AnyHttpUrl, Field, validator

def _normalize_sqlite_url(url: Optional[str]) -> Optional[str]:
    """
    Normalize sqlite URLs across Windows / POSIX.

    Windows drive path   -> sqlite:///C:/path/db.sqlite   (3 slashes)
    Windows UNC path     -> sqlite:////server/share/db.sqlite (4 slashes)
    POSIX absolute path  -> sqlite:////abs/path/db.sqlite (4 slashes)
    Relative path        -> sqlite:///relative.db         (3 slashes)
    In-memory            -> sqlite:///:memory:
    """
    if not url or not url.startswith("sqlite"):
        return url

    url = url.replace("\\", "/")  # tolerate backslashes from .env

    # in-memory forms
    if url in ("sqlite://", "sqlite:///:memory:", "sqlite:///:memory"):
        return "sqlite:///:memory:"

    m = re.match(r"^sqlite:(//+)(.*)$", url)
    if not m:
        # Unexpected format (e.g., sqlite:/weird) -> leave as-is
        return url
    _, rest = m.groups()

    # UNC path like //server/share/path.db  -> four slashes
    if rest.startswith("//"):
        rest = rest.lstrip("/")  # strip leading // we already detected
        return f"sqlite:////{rest}"

    # Windows drive letter C:/... -> exactly three slashes
    if re.match(r"^[A-Za-z]:/", rest):
        return f"sqlite:///{rest}"

    # POSIX absolute path /... -> four slashes
    if rest.startswith("/"):
        return f"sqlite:////{rest}"

    # Relative path -> anchor to project backend dir (works on Windows & POSIX)
    base = pathlib.Path(__file__).resolve().parents[2]  # .../backend
    abs_path = (base / rest).resolve().as_posix()
    # On Windows, abs_path will look like C:/... which should use three slashes
    if re.match(r"^[A-Za-z]:/", abs_path):
        return f"sqlite:///{abs_path}"
    # POSIX absolute
    return f"sqlite:////{abs_path}"


class Settings(BaseSettings):
    PROJECT_NAME: str = "Accommodation"
    API_PREFIX: str = "/api"

    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = []
    BACKEND_CORS_ORIGIN_REGEX: Optional[str] = None

    SECRET_KEY: str = Field(..., description="JWT signing key")

    DATABASE_URL: Optional[str] = None
    SQLALCHEMY_DATABASE_URL: Optional[str] = None

    DEFAULT_PAGE_LIMIT: int = 100
    MAX_PAGE_LIMIT: int = 5000

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"

    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def _parse_cors(cls, v: Any) -> List[AnyHttpUrl]:
        if v is None or v == "": return []
        if isinstance(v, list):   return v
        s = str(v).strip()
        if s.startswith("["):
            try: return json.loads(s)
            except Exception: pass
        return [x.strip() for x in s.split(",") if x.strip()]

    @property
    def DB_URL(self) -> str:
        raw = self.SQLALCHEMY_DATABASE_URL or self.DATABASE_URL or "sqlite:///./accommodation.db"
        return _normalize_sqlite_url(raw)

settings = Settings()
