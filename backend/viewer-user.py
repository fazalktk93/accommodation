#!/usr/bin/env python3
"""
Create or update a viewer-only user named 'afzal'.

- Role: viewer
- Permissions: houses:read, allotments:read
- No file movement permissions
"""

import argparse
from sqlalchemy import select
from app.db.session import get_session
from app.models.user import User, Role
from app.core.security import get_password_hash

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--username", default="afzal")
    ap.add_argument("--password", required=True)
    ap.add_argument("--email", default="afzal@example.com")
    ap.add_argument("--full-name", default="Afzal (Viewer)")
    args = ap.parse_args()

    with next(get_session()) as db:
        existing = db.scalar(select(User).where(User.username == args.username))
        if existing:
            print(f"User '{args.username}' exists → updating as viewer")
            existing.role = Role.viewer.value
            existing.permissions = ["houses:read", "allotments:read"]
            existing.hashed_password = get_password_hash(args.password)
            db.add(existing)
            db.commit()
            print("✅ Updated user successfully.")
            return

        u = User(
            username=args.username,
            full_name=args.__dict__.get("full_name"),
            email=args.email,
            hashed_password=get_password_hash(args.password),
            role=Role.viewer.value,
            is_active=True,
            permissions=["houses:read", "allotments:read"],  # read-only
        )
        db.add(u)
        db.commit()
        db.refresh(u)
        print(f"✅ Created viewer user '{u.username}' (id={u.id})")

if __name__ == "__main__":
    main()
