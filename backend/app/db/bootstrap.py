from __future__ import annotations

from contextlib import contextmanager
from typing import Set
from sqlalchemy import text, inspect
from sqlalchemy.engine import Engine


@contextmanager
def _conn(engine: Engine):
    with engine.connect() as c:
        yield c


def _table_exists(engine: Engine, table: str) -> bool:
    insp = inspect(engine)
    return insp.has_table(table)


def _columns(engine: Engine, table: str) -> Set[str]:
    if not _table_exists(engine, table):
        return set()
    with _conn(engine) as c:
        rows = c.execute(text(f"PRAGMA table_info({table})")).fetchall()
    # PRAGMA table_info columns: cid, name, type, notnull, dflt_value, pk
    return {row[1] for row in rows}


def _add_column(engine: Engine, table: str, ddl: str) -> None:
    # SQLite supports ALTER TABLE ... ADD COLUMN (no IF NOT EXISTS)
    with engine.begin() as c:
        c.execute(text(f"ALTER TABLE {table} ADD COLUMN {ddl}"))


def _try_add(engine: Engine, table: str, col: str, ddl: str) -> None:
    if col not in _columns(engine, table):
        _add_column(engine, table, ddl)


def _maybe_update(engine: Engine, sql: str) -> None:
    with engine.begin() as c:
        c.execute(text(sql))


def _ensure_house(engine: Engine) -> None:
    """
    Ensure canonical columns on 'house':
      file_no TEXT, qtr_no INT, street TEXT, sector TEXT, type_code TEXT,
      status TEXT NOT NULL DEFAULT 'vacant', status_manual INT NOT NULL DEFAULT 0
    Migrate legacy 'file'/'file_number' -> file_no.
    """
    if not _table_exists(engine, "house"):
        return

    cols = _columns(engine, "house")

    _try_add(engine, "house", "file_no", "file_no VARCHAR")
    _try_add(engine, "house", "qtr_no", "qtr_no INTEGER")
    _try_add(engine, "house", "street", "street VARCHAR")
    _try_add(engine, "house", "sector", "sector VARCHAR")
    _try_add(engine, "house", "type_code", "type_code VARCHAR")
    _try_add(engine, "house", "status", "status VARCHAR NOT NULL DEFAULT 'vacant'")
    _try_add(engine, "house", "status_manual", "status_manual INTEGER NOT NULL DEFAULT 0")

    # migrate legacy file column -> file_no
    cols = _columns(engine, "house")
    legacy_file = None
    for candidate in ("file", "file_number", "fileno"):
        if candidate in cols:
            legacy_file = candidate
            break
    if legacy_file and "file_no" in cols:
        _maybe_update(
            engine,
            f"""
            UPDATE house
               SET file_no = COALESCE(file_no, {legacy_file})
             WHERE (file_no IS NULL OR file_no = '')
               AND {legacy_file} IS NOT NULL AND {legacy_file} <> ''
            """
        )

    # backfill defaults
    _maybe_update(engine, "UPDATE house SET status = 'vacant' WHERE status IS NULL OR status = ''")
    _maybe_update(engine, "UPDATE house SET status_manual = 0 WHERE status_manual IS NULL")


def _ensure_allotment(engine: Engine) -> None:
    """
    Ensure canonical columns on 'allotment':
      qtr_status TEXT NOT NULL DEFAULT 'active',
      allottee_status TEXT NOT NULL DEFAULT 'in_service',
      notes TEXT
    Migrate legacy boolean 'active' -> qtr_status.
    """
    if not _table_exists(engine, "allotment"):
        return

    cols = _columns(engine, "allotment")

    _try_add(engine, "allotment", "qtr_status", "qtr_status VARCHAR NOT NULL DEFAULT 'active'")
    _try_add(engine, "allotment", "allottee_status", "allottee_status VARCHAR NOT NULL DEFAULT 'in_service'")
    _try_add(engine, "allotment", "notes", "notes VARCHAR")

    cols = _columns(engine, "allotment")
    # migrate 'active' -> qtr_status
    if "active" in cols and "qtr_status" in cols:
        _maybe_update(
            engine,
            """
            UPDATE allotment
               SET qtr_status = CASE
                                  WHEN active IN (1, '1', 't', 'true', 'TRUE') THEN 'active'
                                  ELSE 'ended'
                                END
             WHERE qtr_status IS NULL OR qtr_status = ''
            """
        )


def _ensure_file_movement(engine: Engine) -> None:
    """
    Ensure canonical columns on 'file_movement':
      file_no, subject, issued_to, department, issue_date, due_date, returned_date, remarks
    """
    if not _table_exists(engine, "file_movement"):
        return

    _try_add(engine, "file_movement", "file_no", "file_no VARCHAR")
    _try_add(engine, "file_movement", "subject", "subject VARCHAR")
    _try_add(engine, "file_movement", "issued_to", "issued_to VARCHAR")
    _try_add(engine, "file_movement", "department", "department VARCHAR")
    _try_add(engine, "file_movement", "issue_date", "issue_date DATE")
    _try_add(engine, "file_movement", "due_date", "due_date DATE")
    _try_add(engine, "file_movement", "returned_date", "returned_date DATE")
    _try_add(engine, "file_movement", "remarks", "remarks VARCHAR")


def ensure_sqlite_schema(engine: Engine) -> None:
    """
    Idempotently upgrades existing SQLite DB to match current models.
    Safe to run on every startup.
    """
    # Only act if tables already exist; create_all will handle new DBs.
    for table in ("house", "allotment", "file_movement"):
        if not _table_exists(engine, table):
            continue

    _ensure_house(engine)
    _ensure_allotment(engine)
    _ensure_file_movement(engine)
