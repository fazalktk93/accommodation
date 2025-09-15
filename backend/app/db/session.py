# app/db/session.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

url = settings.DB_URL
connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}

engine = create_engine(url, pool_pre_ping=True, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Print once on startup so you always know which DB file is used
try:
    print(f"[DB] SQLAlchemy engine.url = {engine.url}")
except Exception:
    pass

def get_session():
    """Return a new SQLAlchemy session. Remember to close() it."""
    return SessionLocal()
