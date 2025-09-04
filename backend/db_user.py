# create_admin.py
# Usage:
#   PYTHONPATH=backend/app python create_admin.py \
#       --username admin --password 'YourStrongPassword' \
#       --email admin@example.com --full-name 'Administrator'

import argparse
from sqlalchemy import select
from sqlalchemy import inspect
from app.db.session import SessionLocal, engine
from app.models.base import Base  # declarative base for all models
from app.models.user import User, Role
from app.core.security import get_password_hash

def ensure_tables():
    """Create tables if they don't exist (useful for fresh SQLite DBs)."""
    insp = inspect(engine)
    if "user" not in insp.get_table_names():
        # Create all mapped tables
        Base.metadata.create_all(bind=engine)

def main():
    parser = argparse.ArgumentParser(description="Create or update an admin user.")
    parser.add_argument("--username", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--email", default=None)
    parser.add_argument("--full-name", dest="full_name", default=None)
    args = parser.parse_args()

    ensure_tables()

    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.username == args.username))
        if user:
            user.hashed_password = get_password_hash(args.password)
            user.role = Role.admin.value
            if args.email is not None:
                user.email = args.email
            if args.full_name is not None:
                user.full_name = args.full_name
            user.is_active = True
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"✅ Updated existing user '{user.username}' to admin.")
        else:
            user = User(
                username=args.username,
                full_name=args.full_name,
                email=args.email,
                hashed_password=get_password_hash(args.password),
                role=Role.admin.value,
                is_active=True,
                permissions=[],
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"✅ Created new admin user '{user.username}'.")
    finally:
        db.close()

if __name__ == "__main__":
    main()
