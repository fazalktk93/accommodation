#!/usr/bin/env python3
"""
Flush (clear) data in the 'allotment' table safely, with optional backup.

Examples:
  # Preview only (no writes)
  python flush_allotment.py --db "sqlite:////home/accommodation/backend/accommodation.db" --dry

  # Full wipe with backup (default table = allotment)
  python flush_allotment.py --db "postgresql://user:pass@localhost:5432/accommodation" --force

  # Delete only a subset (e.g., imported_by='csv_2024_09'), keep the rest
  python flush_allotment.py --db "mysql+mysqlconnector://user:pass@localhost/accommodation" --where "import_tag='csv_2024_09'" --force

  # Skip creating a backup table
  python flush_allotment.py --db "sqlite:///./app.db" --no-backup --force
"""

import argparse
import os
import datetime as dt
from typing import Optional

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

from sqlalchemy import create_engine, MetaData, Table, text, select, func
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError


def env_url(cli: Optional[str]) -> str:
    return cli or os.getenv("DATABASE_URL") or os.getenv("SQLALCHEMY_DATABASE_URI") or "sqlite:///./app.db"


def reflect_table(engine: Engine, name: str) -> Table:
    meta = MetaData()
    meta.reflect(bind=engine, only=[name])
    if name not in meta.tables:
        raise RuntimeError(f"Table '{name}' not found.")
    return meta.tables[name]


def backup_table(engine: Engine, table_name: str) -> str:
    """
    Makes a physical copy of the table: <table>_backup_YYYYmmddHHMMSS
    Works on Postgres/MySQL/SQLite for basic schemas.
    """
    ts = dt.datetime.now().strftime("%Y%m%d%H%M%S")
    backup = f"{table_name}_backup_{ts}"
    with engine.begin() as conn:
        conn.execute(text(f'CREATE TABLE "{backup}" AS SELECT * FROM "{table_name}"'))
    return backup


def count_rows(engine: Engine, table: Table, where_sql: Optional[str]) -> int:
    with engine.connect() as conn:
        if where_sql:
            q = text(f'SELECT COUNT(*) FROM "{table.name}" WHERE {where_sql}')
            return int(conn.execute(q).scalar() or 0)
        else:
            q = select(func.count()).select_from(table)
            return int(conn.execute(q).scalar() or 0)


def truncate_or_delete(engine: Engine, table: Table, where_sql: Optional[str], dry: bool) -> int:
    """
    Performs the destructive action:
      - If WHERE is provided: always uses DELETE WHERE (TRUNCATE doesn’t support WHERE)
      - Else:
         * Postgres: TRUNCATE RESTART IDENTITY CASCADE
         * MySQL: TRUNCATE
         * SQLite: DELETE + reset AUTOINCREMENT
    Returns estimated affected rows (pre-count in WHERE mode; otherwise 0/unknown).
    """
    dialect = engine.dialect.name.lower()
    affected = 0

    if where_sql:  # partial delete
        affected = count_rows(engine, table, where_sql)
        if dry:
            print(f"[DRY] Would DELETE {affected} rows FROM {table.name} WHERE {where_sql}")
            return affected
        with engine.begin() as conn:
            if dialect == "mysql":
                conn.execute(text("SET FOREIGN_KEY_CHECKS=0;"))
            if dialect == "sqlite":
                conn.execute(text("PRAGMA foreign_keys=OFF;"))
            conn.execute(text(f'DELETE FROM "{table.name}" WHERE {where_sql}'))
            if dialect == "mysql":
                conn.execute(text("SET FOREIGN_KEY_CHECKS=1;"))
            if dialect == "sqlite":
                conn.execute(text("PRAGMA foreign_keys=ON;"))
        return affected

    # full wipe
    if dry:
        print(f"[DRY] Would TRUNCATE/DELETE all rows FROM {table.name} and reset identity.")
        return 0

    with engine.begin() as conn:
        if dialect in ("postgresql", "postgres"):
            conn.execute(text(f'TRUNCATE TABLE "{table.name}" RESTART IDENTITY CASCADE;'))
        elif dialect == "mysql":
            conn.execute(text("SET FOREIGN_KEY_CHECKS=0;"))
            conn.execute(text(f'TRUNCATE TABLE `{table.name}`;'))
            conn.execute(text("SET FOREIGN_KEY_CHECKS=1;"))
        elif dialect == "sqlite":
            # SQLite has no TRUNCATE; use DELETE + reset sequence
            conn.execute(text(f'DELETE FROM "{table.name}";'))
            # reset autoincrement if exists
            try:
                conn.execute(text("DELETE FROM sqlite_sequence WHERE name=:n"), {"n": table.name})
            except SQLAlchemyError:
                pass
        else:
            # generic fallback: DELETE all
            conn.execute(text(f'DELETE FROM "{table.name}";'))
    return 0


def main():
    ap = argparse.ArgumentParser(description="Flush (clear) the allotment table safely")
    ap.add_argument("--db", default=None, help='DB URL (e.g., postgresql://user:pass@host/db, sqlite:///file.db)')
    ap.add_argument("--table", default="allotment", help="Table name (default: allotment)")
    ap.add_argument("--where", default=None, help="Optional SQL WHERE to delete a subset (e.g., \"import_tag='csv_2024_09'\")")
    ap.add_argument("--dry", action="store_true", help="Dry run (no writes)")
    ap.add_argument("--no-backup", dest="no_backup", action="store_true", help="Skip creating backup table")
    ap.add_argument("--force", action="store_true", help="Skip confirmation prompt")
    args = ap.parse_args()

    engine = create_engine(env_url(args.db), future=True)

    try:
        table = reflect_table(engine, args.table)
    except RuntimeError as e:
        print(f"[FATAL] {e}")
        return

    # counts (for WHERE mode, we can preview accurately; for full wipe, just show total)
    try:
        total_before = count_rows(engine, table, None)
    except SQLAlchemyError as e:
        print(f"[WARN] Could not count rows: {e}")
        total_before = -1

    target_desc = f"all rows in '{table.name}'" if not args.where else f"rows matching WHERE ({args.where}) in '{table.name}'"
    print(f"[INFO] Database: {engine.url}")
    print(f"[INFO] Table: {table.name}")
    if total_before >= 0:
        print(f"[INFO] Current row count: {total_before}")
    print(f"[INFO] Target: {target_desc}")
    print(f"[INFO] Backup: {'SKIPPED' if args.no_backup else 'ENABLED'}")
    print(f"[INFO] Mode: {'DRY RUN' if args.dry else 'EXECUTE'}")

    if not args.force:
        try:
            prompt = input("Type 'YES' to proceed: ").strip()
        except KeyboardInterrupt:
            print("\n[ABORT] Cancelled.")
            return
        if prompt != "YES":
            print("[ABORT] Confirmation not given.")
            return

    if not args.no_backup and not args.dry:
        try:
            name = backup_table(engine, table.name)
            print(f"[OK] Backup created: {name}")
        except SQLAlchemyError as e:
            print(f"[WARN] Backup failed: {e}")

    try:
        affected = truncate_or_delete(engine, table, args.where, args.dry)
    except SQLAlchemyError as e:
        print(f"[ERROR] Flush failed: {e}")
        return

    if args.dry:
        print(f"[DRY DONE] No changes written.")
        return

    # Post counts (best-effort)
    try:
        total_after = count_rows(engine, table, None)
        if args.where:
            print(f"[DONE] Deleted ~{affected} rows matching WHERE; current total rows: {total_after}")
        else:
            print(f"[DONE] Table cleared. Current total rows: {total_after}")
    except SQLAlchemyError:
        print("[DONE] Flush completed.")

if __name__ == "__main__":
    main()
