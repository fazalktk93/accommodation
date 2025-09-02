# backend/app/db/session.py
import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

DB_URL = os.getenv("SQLALCHEMY_DATABASE_URL", settings.SQLALCHEMY_DATABASE_URL)

if settings.FORCE_POSTGRES and (DB_URL.startswith("sqlite")):
    raise RuntimeError("FORCE_POSTGRES=1 but DB URL is SQLite")

if DB_URL.startswith("sqlite"):
    engine = create_engine(
        DB_URL,
        connect_args={"check_same_thread": False},
        pool_pre_ping=True,
    )

    # SQLite tuning for small production apps
    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_conn, _):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA journal_mode=WAL;")   # better read concurrency
        cur.execute("PRAGMA synchronous=NORMAL;") # durability/latency tradeoff
        cur.execute("PRAGMA busy_timeout=5000;")  # wait up to 5s on locks
        cur.close()
else:
    # keep a modest pool if you later point to Postgres
    engine = create_engine(
        DB_URL,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        pool_recycle=1800,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
