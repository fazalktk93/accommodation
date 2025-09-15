# alembic/env.py
from __future__ import annotations

import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool
from sqlalchemy.engine import make_url

# --- Bootstrap Python path so "app" can be imported ---
# assuming this file lives at <repo>/backend/alembic/env.py
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# Alembic config
config = context.config

# Logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import settings & metadata
from app.core.config import settings
try:
    from app.models.base import Base
except Exception:
    from app.models import Base  # pragma: no cover

target_metadata = Base.metadata


def _resolve_db_url() -> str:
    # 1) settings.DB_URL
    if getattr(settings, "DB_URL", None):
        return settings.DB_URL

    # 2) common env var names
    for key in ("SQLALCHEMY_DATABASE_URL", "DATABASE_URL", "DB_URL"):
        val = os.getenv(key)
        if val:
            return val

    # 3) fallback to repo-local SQLite file under backend/
    # Use absolute path to avoid CWD issues.
    sqlite_path = os.path.join(BACKEND_DIR, "accommodation.db")
    return f"sqlite:///{sqlite_path}"

DB_URL = _resolve_db_url()
url_obj = make_url(DB_URL)

# If SQLite with a filesystem path, ensure the parent directory exists.
# (Ignore memory DBs like sqlite:// or sqlite:///:memory:)
if url_obj.get_backend_name() == "sqlite":
    # url_obj.database is the filesystem path (may be relative or absolute)
    db_path = url_obj.database or ""
    # Convert relative to absolute for reliability
    if db_path and not os.path.isabs(db_path):
        db_path = os.path.abspath(db_path)
        # rebuild DB_URL with absolute path
        DB_URL = f"sqlite:///{db_path}"
        url_obj = make_url(DB_URL)

    # Create parent directory if needed (no-op if already exists)
    if db_path and db_path not in (":memory:",):
        parent = os.path.dirname(db_path)
        if parent and not os.path.exists(parent):
            os.makedirs(parent, exist_ok=True)

# Reflect URL into Alembic for offline mode
config.set_main_option("sqlalchemy.url", DB_URL)


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode'."""
    context.configure(
        url=DB_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode'."""
    connect_args = {}
    if url_obj.get_backend_name() == "sqlite":
        # this avoids thread complaints, and is harmless for Alembic
        connect_args["check_same_thread"] = False

    engine = create_engine(DB_URL, poolclass=pool.NullPool, connect_args=connect_args)
    with engine.connect() as connection:
        print(f"[alembic] dialect={connection.dialect.name} url={connection.engine.url}")
        if url_obj.get_backend_name() == "sqlite" and url_obj.database:
            print(f"[alembic] sqlite file: {url_obj.database}")

        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
