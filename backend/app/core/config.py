# app/core/config.py
from __future__ import annotations

import os, pathlib, re
from typing import List

from pydantic import AnyHttpUrl, Field, field_validator, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _normalize_sqlite_url(url: str) -> str:
    if not url or not url.startswith("sqlite"):
        return url

    # Normalize slashes for cross-platform safety
    url = url.replace("\\", "/")

    m = re.match(r"^sqlite:(//+)(.*)$", url)
    if not m:
        return url
    _, rest = m.groups()

    # Windows drive like C:/path.db -> need 4 slashes
    if re.match(r"^[A-Za-z]:/", rest):
        return f"sqlite:////{rest}"

    p = pathlib.Path(rest)
    if not p.is_absolute():
        # make relative paths absolute to the backend folder
        base = pathlib.Path(__file__).resolve().parents[2]  # .../backend
        abs_path = (base / rest).resolve().as_posix()
        return f"sqlite:///{abs_path}"

    return f"sqlite:///{p.as_posix()}"


class Settings(BaseSettings):
    # ✅ v2-style config: this is what makes .env load!
    model_config = SettingsConfigDict(
        env_file=".env",      # load environment variables from .env
        extra="allow",        # allow unexpected extras (they will be accessible via .model_extra)
    )

    # ----- App basics -----
    PROJECT_NAME: str = "Accommodation"

    # Accept either a JSON-style list or a comma-separated string via .env
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = Field(default_factory=list)

    # ----- Security -----
    # will read SECRET_KEY from environment/.env
    SECRET_KEY: str = Field(default="")   # set in .env: SECRET_KEY=your-long-random-string
    # (add other auth settings if you use them)
    # ALGORITHM: str = "HS256"
    # ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # ----- Database -----
    DATABASE_URL: str = ""                      # preferred
    SQLALCHEMY_DATABASE_URL: str | None = None  # backwards-compat

    # Parse comma-separated CORS list like: http://localhost:3000,https://example.com
    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def _split_cors(cls, v):
        if isinstance(v, str):
            # allow JSON-style strings to pass through unchanged
            if v.strip().startswith("["):
                return v
            # comma-separated -> list
            return [s.strip() for s in v.split(",") if s.strip()]
        return v

    @computed_field  # type: ignore[misc]
    @property
    def DB_URL(self) -> str:
        """
        Single source of truth for the app. Normalizes SQLite paths.
        Priority:
          1) DATABASE_URL
          2) SQLALCHEMY_DATABASE_URL
          3) default to ./accommodation.db under backend/
        """
        url = self.DATABASE_URL or (self.SQLALCHEMY_DATABASE_URL or "")
        if not url:
            url = "sqlite:///./accommodation.db"
        return _normalize_sqlite_url(url)


settings = Settings()
