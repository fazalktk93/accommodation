from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.user import User
from app.schemas.user import UserCreate
from app.core.security import get_password_hash

def get_by_username(db: Session, username: str) -> User | None:
    return db.scalar(select(User).where(User.username == username))

def create(db: Session, payload: UserCreate) -> User:
    user = User(
        username=payload.username,
        full_name=payload.full_name,
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        role=payload.role or "viewer",
        permissions=payload.permissions or [],
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
