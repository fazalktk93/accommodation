import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

DB_URL = os.getenv("SQLALCHEMY_DATABASE_URL", settings.SQLALCHEMY_DATABASE_URL)

if settings.FORCE_POSTGRES and (DB_URL.startswith("sqlite") or "+psycopg2" not in DB_URL):
    raise RuntimeError(
        "FORCE_POSTGRES=1, but SQLALCHEMY_DATABASE_URL is not a psycopg2 Postgres URL."
    )

# Tweak the pool for web workloads; keep it modest for dev
engine = create_engine(
    DB_URL,
    pool_size=10,          # number of persistent connections
    max_overflow=20,       # extra connections above pool_size
    pool_pre_ping=True,    # recycle dead connections
    pool_recycle=1800,     # seconds; avoids stale connections (30 min)
    connect_args={
        # Fail slow queries rather than piling up
        "options": "-c statement_timeout=5000",  # 5s; tune as needed
    },
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
