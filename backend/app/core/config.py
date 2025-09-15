# app/core/config.py
from __future__ import annotations
import pathlib, re
from typing import List
from pydantic import Field, field_validator, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict

def _normalize_sqlite_url(url: str) -> str:
    if not url or not url.startswith("sqlite"):
        return url
    url = url.replace("\\", "/")
    m = re.match(r"^sqlite:(//+)(.*)$", url)
    if not m:
        return url
    _, rest = m.groups()
    if re.match(r"^[A-Za-z]:/", rest):
        return f"sqlite:////{rest}"
    p = pathlib.Path(rest)
    if not p.is_absolute():
        base = pathlib.Path(__file__).resolve().parents[2]
        abs_path = (base / rest).resolve().as_posix()
        return f"sqlite:///{abs_path}"
    return f"sqlite:///{p.as_posix()}"

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="allow")

    # ----- App basics -----
    PROJECT_NAME: str = "Accommodation"
    API_PREFIX: str = "/api"

    # Make this lenient — accept *, IPs, bare hosts, with/without scheme
    BACKEND_CORS_ORIGINS: List[str] = Field(default_factory=list)

    # ----- Security -----
    SECRET_KEY: str = Field(default="")  # set in .env

    # ----- Database -----
    DATABASE_URL: str = ""
    SQLALCHEMY_DATABASE_URL: str | None = None

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def _normalize_cors(cls, v):
        # Accept JSON list or comma-separated string or single string
        def _split(val):
            if isinstance(val, list):
                return val
            if isinstance(val, str):
                s = val.strip()
                if not s:
                    return []
                if s.startswith("[") and s.endswith("]"):
                    # JSON-style list string -> eval safely
                    import json
                    try:
                        parsed = json.loads(s)
                        return parsed if isinstance(parsed, list) else [s]
                    except Exception:
                        return [s]
                return [x.strip() for x in s.split(",") if x.strip()]
            return []

        def _coerce_url(x: str) -> str:
            if x == "*" or x.lower() == "null":
                return x
            # Add scheme if missing
            if not re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://", x):
                # Allow bare hosts/IPs/localhost
                x = "http://" + x
            # strip trailing slash for consistency
            if x.endswith("/"):
                x = x[:-1]
            return x

        items = _split(v)
        return [_coerce_url(x) for x in items]

    @computed_field  # type: ignore[misc]
    @property
    def DB_URL(self) -> str:
        url = self.DATABASE_URL or (self.SQLALCHEMY_DATABASE_URL or "")
        if not url:
            url = "sqlite:///./accommodation.db"
        return _normalize_sqlite_url(url)

settings = Settings()
