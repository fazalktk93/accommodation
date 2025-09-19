# app/core/permissions.py
from __future__ import annotations
from typing import Dict, List

# Atomic permissions (leave here for future, but UI won't use them)
ALL_PERMISSIONS: set[str] = {
    # Houses
    "house.view", "house.create", "house.edit", "house.delete", "house.export",
    # Allotments
    "allotment.view", "allotment.create", "allotment.edit", "allotment.delete", "allotment.export",
    # Files
    "file.view", "file.create", "file.edit", "file.delete", "file.return",
    # Users
    "user.view", "user.create", "user.edit", "user.delete",
    # Admin
    "admin.audit.view", "admin.config.edit",
}

# Define exactly three roles: admin / manager / viewer
# Map each role -> effective permissions (no typing needed on FE)
ROLE_DEFAULT_PERMISSIONS: Dict[str, List[str]] = {
    "viewer": [
        "house.view", "allotment.view", "file.view", "user.view"
    ],
    "manager": [
        # read + write, but no deletes or admin config
        "house.view", "house.create", "house.edit", "house.export",
        "allotment.view", "allotment.create", "allotment.edit", "allotment.export",
        "file.view", "file.create", "file.edit", "file.return",
        "user.view",  # can view users but not create/edit/delete
    ],
    "admin": [
        # full control
        "house.view", "house.create", "house.edit", "house.delete", "house.export",
        "allotment.view", "allotment.create", "allotment.edit", "allotment.delete", "allotment.export",
        "file.view", "file.create", "file.edit", "file.delete", "file.return",
        "user.view", "user.create", "user.edit", "user.delete",
        "admin.audit.view", "admin.config.edit",
    ],
}

def defaults_for_role(role: str) -> List[str]:
    """Return effective permissions for a role; fall back to viewer."""
    role = (role or "viewer").lower()
    return sorted(set(ROLE_DEFAULT_PERMISSIONS.get(role, ROLE_DEFAULT_PERMISSIONS["viewer"])))

def list_roles() -> list[str]:
    """The only roles the UI should offer."""
    return ["admin", "manager", "viewer"]

def catalog() -> dict:
    """Optional: keep for tooling/UIs; returns roles and their perms."""
    return {
        "roles": list_roles(),
        "role_permissions": {r: defaults_for_role(r) for r in list_roles()},
        "all_permissions": sorted(ALL_PERMISSIONS),
    }
