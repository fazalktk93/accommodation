# backend/alembic/env.py
from __future__ import annotations

import os
import sys
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

# --- Make sure Python can import the app package ("backend/app") ---
# This file lives at backend/alembic/env.py
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# Now we can import app modules
from app.models import Base  # __init__ should import all models
# -------------------------------------------------------------------

# Alembic Config object (reads alembic.ini)
config = context.config

# Use the same DB URL as the app
db_url = os.getenv("SQLALCHEMY_DATABASE_URL")
if db_url:
    config.set_main_option("sqlalchemy.url", db_url)

# Configure Python logging from alembic.ini (optional)
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Tell Alembic what metadata to compare for migrations
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,   # detect column type changes
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,  # Alembic shouldn't reuse the app pool
    )

    with connectable.connect() as connection:
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
