from sqlmodel import SQLModel, create_engine, Session
from app.core.config import settings

# SQLite needs this connect arg
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(settings.DATABASE_URL, echo=False, connect_args=connect_args)

def get_session() -> Session:
    return Session(engine)
