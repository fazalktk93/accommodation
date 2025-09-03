from typing import Generator
from app.db.session import SessionLocal
from app.db.session import engine

def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
