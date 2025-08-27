# backend/scripts/reset_password.py
from sqlalchemy.orm import Session
from sqlalchemy import select
from getpass import getpass
from app.db import Base, engine, SessionLocal
from app.models.domain import User
from app.utils.security import hash_password
from app.config import settings

def main():
    print("DATABASE_URL:", settings.database_url)
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    email = input("User email: ").strip()
    user = db.scalar(select(User).where(User.email == email))
    if not user:
        print("No such user.")
        return
    pwd = getpass("New password: ").strip()
    if not pwd:
        print("Blank password not allowed.")
        return
    user.password_hash = hash_password(pwd)
    db.add(user); db.commit()
    print("Password updated ✔")

if __name__ == "__main__":
    main()
