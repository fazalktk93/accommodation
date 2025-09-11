#!/usr/bin/env python3
"""
Ensure the admin has a proper JSON list of full permissions.
Usage:
    export PYTHONPATH=backend/app
    python fix_admin_perms.py --username admin
"""

import argparse
from sqlalchemy import select
from app.db.session import get_session
from app.models.user import User, Role

FULL_PERMS = [
    # Houses
    "houses:read", "houses:create", "houses:update", "houses:delete",
    # Allotments
    "allotments:read", "allotments:create", "allotments:update", "allotments:delete",
    # File movement
    "files:read", "files:issue", "files:update", "files:return", "files:delete",
]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--username", default="admin")
    args = ap.parse_args()

    with next(get_session()) as db:
        u = db.scalar(select(User).where(User.username == args.username))
        if not u:
            print(f"❌ User '{args.username}' not found")
            return

        print("Before:", u.username, u.role, type(u.permissions), u.permissions)
        u.role = Role.admin.value
        u.permissions = list(FULL_PERMS)  # ensure real JSON list
        db.add(u)
        db.commit()
        db.refresh(u)
        print("After :", u.username, u.role, type(u.permissions), u.permissions)
        print("✅ Admin permissions repaired.")

if __name__ == "__main__":
    main()
