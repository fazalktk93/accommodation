# backend/scripts/check_auth.py
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db import Base, engine, SessionLocal
from app.config import settings
from app.models.domain import User
from app.utils.security import verify_password

def main():
    print("DATABASE_URL:", settings.database_url)
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    users = db.scalars(select(User).order_by(User.id.asc())).all()
    print(f"Users in DB ({len(users)}):")
    for u in users:
        print(f" - id={u.id} email={u.email} role={u.role}")

    try:
        import sys
        email = sys.argv[1]
        pwd = sys.argv[2] if len(sys.argv) > 2 else None
    except Exception:
        email = pwd = None

    if email:
        user = db.scalar(select(User).where(User.email == email))
        if not user:
            print(f"No user found: {email}")
            return
        if pwd is not None:
            print("Password match:", verify_password(pwd, user.password_hash))

if __name__ == "__main__":
    main()
