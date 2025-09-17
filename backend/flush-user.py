#!/usr/bin/env python3
"""
Remove all rows from the user table.

Examples:
  python flush_users.py --db "postgresql://user:pass@localhost:5432/app" --table user --force
  python flush_users.py --db "mysql+mysqlconnector://user:pass@localhost/app" --table users --force
  python flush_users.py --db "sqlite:////path/to/app.db" --table user --force
"""

import argparse, os
from sqlalchemy import create_engine, MetaData, Table, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError

def env_url(cli: str | None) -> str:
    return cli or os.getenv("DATABASE_URL") or os.getenv("SQLALCHEMY_DATABASE_URI") or "sqlite:///./app.db"

def reflect_table(engine: Engine, name: str) -> Table:
    meta = MetaData()
    meta.reflect(bind=engine, only=[name])
    if name not in meta.tables:
        raise RuntimeError(f"Table '{name}' not found.")
    return meta.tables[name]

def clear_users(engine: Engine, table: Table, dry: bool):
    dialect = engine.dialect.name.lower()
    with engine.begin() as conn:
        if dry:
            print(f"[DRY] Would clear all rows from '{table.name}'.")
            return
        if dialect in ("postgresql", "postgres"):
            conn.execute(text(f'TRUNCATE TABLE "{table.name}" RESTART IDENTITY CASCADE;'))
        elif dialect == "mysql":
            conn.execute(text("SET FOREIGN_KEY_CHECKS=0;"))
            conn.execute(text(f'TRUNCATE TABLE `{table.name}`;'))
            conn.execute(text("SET FOREIGN_KEY_CHECKS=1;"))
        elif dialect == "sqlite":
            conn.execute(text(f'DELETE FROM "{table.name}";'))
            try:
                conn.execute(text("DELETE FROM sqlite_sequence WHERE name=:n"), {"n": table.name})
            except SQLAlchemyError:
                pass
        else:
            conn.execute(text(f'DELETE FROM "{table.name}";'))

def main():
    ap = argparse.ArgumentParser(description="Remove all users from the user table")
    ap.add_argument("--db", default=None, help="DB URL")
    ap.add_argument("--table", default="user", help="Table name (default: user)")
    ap.add_argument("--dry", action="store_true", help="Preview only (don’t delete)")
    ap.add_argument("--force", action="store_true", help="Skip confirmation prompt")
    args = ap.parse_args()

    engine = create_engine(env_url(args.db), future=True)

    try:
        table = reflect_table(engine, args.table)
    except RuntimeError as e:
        print(f"[FATAL] {e}")
        return

    if not args.force:
        ans = input(f"⚠️ Really delete ALL rows from table '{args.table}'? (y/N) ")
        if ans.strip().lower() != "y":
            print("Aborted.")
            return

    clear_users(engine, table, args.dry)
    print(f"[DONE] Cleared all rows from '{args.table}'.")

if __name__ == "__main__":
    main()
