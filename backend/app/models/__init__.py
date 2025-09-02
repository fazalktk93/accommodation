# Ensure all models are imported so SQLAlchemy can resolve relationships reliably.
from .base import Base
from .house import House
from .allotment import Allotment
from .file_movement import FileMovement

__all__ = ["Base", "House", "Allotment", "FileMovement"]
