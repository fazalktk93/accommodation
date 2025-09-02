# Ensure all models are imported so SQLAlchemy sees them when configuring mappers.
from .base import Base
from .house import House
from .allotment import Allotment
from .file_movement import FileMovement

__all__ = ["Base", "House", "Allotment", "FileMovement"]
