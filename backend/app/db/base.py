# Import all models so Alembic can discover them.
from app.db.base_class import Base  # noqa
from app.models.house import House  # noqa
from app.models.allotment import Allotment  # noqa
from app.models.file_movement import FileMovement  # noqa
