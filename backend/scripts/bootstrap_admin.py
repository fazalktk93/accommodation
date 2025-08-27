# backend/scripts/bootstrap_admin.py
from getpass import getpass
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db import engine, Base, SessionLocal
from app.models.domain import User, RoleEnum
from app.utils.security import hash_password
from app.config import settings

def main():
    print("DATABASE_URL:", settings.database_url)
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    email = input("Admin email: ").strip()
    if not email:
        print("Email required"); return
    password = getpass("Admin password: ").strip()
    if not password:
        print("Password required"); return

    existing = db.scalar(select(User).where(User.email == email))
    if existing:
        print(f"User with email {email} already exists (role={existing.role}).")
        return

    user = User(email=email, password_hash=hash_password(password), role=RoleEnum.admin)
    db.add(user); db.commit(); db.refresh(user)
    print(f"Admin user created: id={user.id} email={user.email}")

if __name__ == "__main__":
    main()
