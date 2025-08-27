# backend/scripts/bootstrap_admin.py
import sys
from getpass import getpass
from sqlalchemy.orm import Session
from app.db import engine, Base, SessionLocal
from app.models.domain import User, RoleEnum
from app.utils.security import hash_password

def main():
    Base.metadata.create_all(bind=engine)  # ensure tables exist

    db: Session = SessionLocal()

    # Ask for email & password interactively
    email = input("Admin email: ").strip()
    password = getpass("Admin password: ").strip()

    if db.query(User).filter_by(email=email).first():
        print(f"User with email {email} already exists")
        return

    user = User(
        email=email,
        password_hash=hash_password(password),
        role=RoleEnum.admin,
    )
    db.add(user)
    db.commit()
    print(f"Admin user {email} created ✔")

if __name__ == "__main__":
    main()
