#!/usr/bin/env python3
"""
Create or repair a viewer-only user.

Viewer role:
  - role = viewer
  - permissions = ["houses:read", "allotments:read"]
  - no file movement permissions
"""

import argparse
from sqlalchemy import select
from app.db.session import get_session
from app.models.user import User, Role
from app.core.security import get_password_hash

VIEWER_PERMS = ["houses:read", "allotments:read"]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--username", default="afzal", help="Username of viewer")
    ap.add_argument("--password", help="Set password (optional)")
    ap.add_argument("--email", default="viewer@example.com")
    ap.add_argument("--full-name", default="Viewer User")
    args = ap.parse_args()

    with next(get_session()) as db:
        user = db.scalar(select(User).where(User.username == args.username))
        if user:
            print(f"ℹ️ Updating existing user '{args.username}'")
            user.role = Role.viewer.value
            user.permissions = list(VIEWER_PERMS)
            if args.password:
                user.hashed_password = get_password_hash(args.password)
            if args.email:
                user.email = args.email
            if args.full_name:
                user.full_name = args.full_name
            user.is_active = True
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"✅ User '{user.username}' fixed as viewer with read-only permissions.")
        else:
            print(f"ℹ️ Creating new user '{args.username}'")
            hashed = get_password_hash(args.password or "ChangeMe#123")
            user = User(
                username=args.username,
                full_name=args.full_name,
                email=args.email,
                hashed_password=hashed,
                role=Role.viewer.value,
                is_active=True,
                permissions=list(VIEWER_PERMS),
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"✅ Created new viewer user '{user.username}' (id={user.id})")

if __name__ == "__main__":
    main()
