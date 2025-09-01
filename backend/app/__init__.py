# backend/app/__init__.py
# Make "from app import schemas, models" work.
from . import schemas as schemas  # noqa: F401
from . import models as models    # noqa: F401

__all__ = ["schemas", "models"]
