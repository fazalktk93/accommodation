import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# --- load .env (without adding new deps) ---
# If you already use python-dotenv, you can import and load it here.
# Otherwise, we parse a very simple KEY=VALUE .env manually:
ENV_PATH = Path(__file__).resolve().parents[2] / ".env"  # .../backend/.env
if ENV_PATH.exists():
    for line in ENV_PATH.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())

DB_URL = os.getenv("SQLALCHEMY_DATABASE_URL", "sqlite:///./accommodation.db")

# Fail fast if you *want* Postgres but fell back to sqlite
if os.getenv("FORCE_POSTGRES", "0") == "1" and DB_URL.startswith("sqlite"):
    raise RuntimeError(
        "API is about to use SQLite (DB_URL = sqlite...). Set SQLALCHEMY_DATABASE_URL in backend/.env to your Postgres URL."
    )

print(f">>> Using DB: {DB_URL}")  # <-- you will see this on startup

connect_args = {"check_same_thread": False} if DB_URL.startswith("sqlite") else {}
engine = create_engine(DB_URL, pool_pre_ping=True, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
