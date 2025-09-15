# alembic/env.py
from __future__ import annotations

import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

# --- Bootstrap Python path so "app" can be imported ---
# assuming this file lives at <repo>/backend/alembic/env.py
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# --- Alembic Config object ---
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# --- Import app settings & metadata ---
from app.core.config import settings

# Try to import Base from a canonical place; fall back if your project exports it differently
try:
    from app.models.base import Base
except Exception:
    from app.models import Base  # pragma: no cover

target_metadata = Base.metadata

# --- Resolve the one true DB URL (single source of truth) ---
def _resolve_db_url() -> str:
    # 1) settings.DB_URL (recommended)
    if getattr(settings, "DB_URL", None):
        return settings.DB_URL

    # 2) env var (supports common names)
    for key in ("SQLALCHEMY_DATABASE_URL", "DATABASE_URL", "DB_URL"):
        val = os.getenv(key)
        if val:
            return val

    # 3) fallback to a repo-local SQLite file
    return f"sqlite:///{os.path.join(BASE_DIR, 'accommodation.db')}"

DB_URL = _resolve_db_url()

# reflect the chosen URL into alembic.ini config so offline mode works, etc.
config.set_main_option("sqlalchemy.url", DB_URL)


# --- Migration runners ---
def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = DB_URL
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    engine = create_engine(DB_URL, poolclass=pool.NullPool)

    with engine.connect() as connection:
        # helpful one-line log so you can confirm which DB Alembic is hitting
        print(f"[alembic] dialect={connection.dialect.name} url={connection.engine.url}")

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
