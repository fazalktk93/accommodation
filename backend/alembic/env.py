# backend/alembic/env.py
from __future__ import annotations
import os, sys
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

# Make sure we can import "app"
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app.models import Base  # __init__ should import all models

config = context.config

# Read DB URL from env; fallback to SQLite file inside backend/
db_url = os.getenv("SQLALCHEMY_DATABASE_URL")
if not db_url:
    db_path = os.path.join(BASE_DIR, "accommodation.db")
    # absolute path avoids surprises with working directory
    db_url = f"sqlite:///{db_path}"

# set Alembic's sqlalchemy.url
config.set_main_option("sqlalchemy.url", db_url)

# optional logging setup from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
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
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        # small debug print so you can see which DB it targets
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
