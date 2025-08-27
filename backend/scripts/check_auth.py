# backend/scripts/check_auth.py
import os
import sys
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db import Base, engine, SessionLocal
from app.config import settings
from app.models.domain import User
from app.utils.security import verify_password

def main():
    print("DATABASE_URL:", settings.database_url)
    Base.metadata.create_all(bind=engine)

    if len(sys.argv) < 2:
        print("Usage: python -m scripts.check_auth <email> [password]")
        print("Lists users if no password, or verifies password if provided.")
        print()
    db: Session = SessionLocal()

    # List all users
    users = db.scalars(select(User).order_by(User.id.asc())).all()
    print(f"Users in DB ({len(users)}):")
    for u in users:
        print(f" - id={u.id} email={u.email} role={u.role}")

    email = sys.argv[1] if len(sys.argv) >= 2 else None
    pwd = sys.argv[2] if len(sys.argv) >= 3 else None
    if email:
        user = db.scalar(select(User).where(User.email == email))
        if not user:
            print(f"\nNo user found with email: {email}")
            return
        print(f"\nFound user: id={user.id} email={user.email} role={user.role}")
        if pwd is not None:
            ok = verify_password(pwd, user.password_hash)
            print("Password match:", ok)

if __name__ == "__main__":
    main()
