from typing import Generator
from sqlmodel import Session
from app.db.session import get_session

def get_db() -> Generator[Session, None, None]:
    db = get_session()
    try:
        yield db
    finally:
        db.close()
