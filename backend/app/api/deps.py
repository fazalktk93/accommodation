from typing import Generator, Dict
from fastapi import Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_session

MAX_LIMIT = 5000

def get_db() -> Generator[Session, None, None]:
    """
    Your routes already import this (sync). Keep it as a thin wrapper around SessionLocal.
    """
    yield from get_session()

def pagination_params(
    offset: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(50, ge=1, le=MAX_LIMIT, description="Max items to return (<=5000)"),
) -> Dict[str, int]:
    return {"offset": offset, "limit": limit}
