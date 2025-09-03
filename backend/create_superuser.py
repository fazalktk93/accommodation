# backend/create_superuser.py
import os
from sqlalchemy.orm import Session
from sqlalchemy import select
from passlib.context import CryptContext

from app.db.session import get_session
from app.models.user import User
from app.models.user import Role

# Configure passlib for bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_superuser(username: str, password: str, email: str = "admin@example.com"):
    # Open a DB session using your app's session maker
    with next(get_session()) as db:  # get_session() yields a Session
        # Check if user already exists
        existing = db.scalar(select(User).where(User.username == username))
        if existing:
            print(f"User '{username}' already exists with id={existing.id}")
            return existing

        # Hash the password
        hashed = pwd_context.hash(password)

        # Create superuser with full permissions
        user = User(
            username=username,
            full_name="Super Admin",
            email=email,
            hashed_password=hashed,
            is_active=True,
            role=Role.admin.value,
            permissions=[
                "houses:create", "houses:update", "houses:delete",
                "allotments:delete", "files:issue", "files:return"
            ],
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"✅ Superuser created: {user.username} (id={user.id})")
        return user

if __name__ == "__main__":
    create_superuser("admin", "12345")
