from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.engine.url import make_url
from app.core.config import settings

SQLALCHEMY_DATABASE_URI = settings.SQLALCHEMY_DATABASE_URI
url = make_url(SQLALCHEMY_DATABASE_URI)
connect_args = {"check_same_thread": False} if url.get_backend_name() == "sqlite" else {}

engine = create_engine(SQLALCHEMY_DATABASE_URI, pool_pre_ping=True, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
