# create_admin.py
# Usage example:
#   PYTHONPATH=backend/app python create_admin.py \
#       --username admin \
#       --password 'YourStrongPassword' \
#       --email admin@example.com \
#       --full-name 'Administrator'

import argparse
from sqlalchemy import select
from app.db.session import SessionLocal
from app.models.user import User, Role
from app.core.security import get_password_hash


def main():
    parser = argparse.ArgumentParser(description="Create or update an admin user.")
    parser.add_argument("--username", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--email", default=None)
    parser.add_argument("--full-name", dest="full_name", default=None)
    args = parser.parse_args()

    db = SessionLocal()
    try:
        # Check if user exists
        user = db.scalar(select(User).where(User.username == args.username))
        if user:
            # Update existing user
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
            # Create new admin user
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
