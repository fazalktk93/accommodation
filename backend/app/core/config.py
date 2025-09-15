# app/core/config.py  (Pydantic v1)
from __future__ import annotations
import os, pathlib, re, json
from typing import List, Optional
from pydantic import BaseSettings, AnyHttpUrl, validator

def _normalize_sqlite_url(url: str) -> str:
    if not url or not url.startswith("sqlite"):
        return url
    url = url.replace("\\", "/")
    m = re.match(r"^sqlite:(//+)(.*)$", url)
    if not m:
        return url
    _, rest = m.groups()
    if re.match(r"^[A-Za-z]:/", rest):   # Windows drive
        return f"sqlite:////{rest}"
    p = pathlib.Path(rest)
    if not p.is_absolute():
        base = pathlib.Path(__file__).resolve().parents[2]  # .../backend
        abs_path = (base / rest).resolve().as_posix()
        return f"sqlite:///{abs_path}"
    return f"sqlite:///{p.as_posix()}"

class Settings(BaseSettings):
    # ----- App basics -----
    PROJECT_NAME: str = "Accommodation"
    API_PREFIX: str = "/api"

    # Be lenient: allow strings/CSV/JSON list; we’ll coerce to plain strings
    BACKEND_CORS_ORIGINS: List[str] = []
    # Optional regex string for origins (some apps use this)
    BACKEND_CORS_ORIGIN_REGEX: Optional[str] = None

    # ----- Security -----
    SECRET_KEY: str = ""  # set in .env

    # ----- Database -----
    DATABASE_URL: str = ""
    SQLALCHEMY_DATABASE_URL: Optional[str] = None  # compat alias

    class Config:
        env_file = ".env"
        extra = "allow"

    # Accept CSV / JSON / AnyHttpUrl lists and coerce to strings w/ scheme when missing
    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def _normalize_cors(cls, v):
        def split(val):
            if isinstance(val, list):
                return val
            if isinstance(val, str):
                s = val.strip()
                if not s:
                    return []
                if s.startswith("[") and s.endswith("]"):
                    try:
                        parsed = json.loads(s)
                        return parsed if isinstance(parsed, list) else [s]
                    except Exception:
                        return [s]
                return [x.strip() for x in s.split(",") if x.strip()]
            return []

        def coerce(x: str) -> str:
            if x in ("*", "null", "NULL"):
                return x
            if not re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://", x):
                x = "http://" + x
            return x[:-1] if x.endswith("/") else x

        return [coerce(x) for x in split(v)]

    @property
    def DB_URL(self) -> str:
        url = self.DATABASE_URL or (self.SQLALCHEMY_DATABASE_URL or "")
        if not url:
            url = "sqlite:///./accommodation.db"
        return _normalize_sqlite_url(url)

settings = Settings()
