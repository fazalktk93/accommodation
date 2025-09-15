# app/db/session.py
from contextlib import contextmanager
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

url = settings.DB_URL  # normalized by app/core/config.py
connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}

engine = create_engine(url, pool_pre_ping=True, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

# Log once on startup so you know which DB is being used
try:
    print(f"[DB] SQLAlchemy engine.url = {engine.url}")
except Exception:
    pass

def get_session():
    """
    FastAPI dependency (yield a session and always close it).
    Works with:
      - `Depends(get_db)` -> `yield from get_session()`
      - `with next(get_session()) as db:` (Session is a context manager)
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@contextmanager
def session_scope():
    """
    Optional helper for scripts/CLI:
      with session_scope() as db:
          db.add(obj)
    Commits on success, rollbacks on error.
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
