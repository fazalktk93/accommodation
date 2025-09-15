# backend/fix_db.py
from __future__ import annotations
import os
import sys
from pathlib import Path
from typing import List, Tuple, Optional

from sqlalchemy import create_engine, text, inspect
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

# ---------- bootstrap so "app" is importable ----------
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# ---------- import your app config & metadata ----------
from app.core.config import settings
try:
    # your project exports models here
    from app.models import Base, House, Allotment, FileMovement  # type: ignore
except Exception:
    # absolute minimum to reach Base
    from app.models.base import Base  # type: ignore
    House = Allotment = FileMovement = None  # type: ignore


# ---------- DB URL resolution identical to app ----------
def resolve_db_url() -> str:
    url = getattr(settings, "DB_URL", "") or ""
    if url:
        return url

    for k in ("SQLALCHEMY_DATABASE_URL", "DATABASE_URL", "DB_URL"):
        v = os.getenv(k)
        if v:
            return v

    # fallback: backend/accommodation.db (same default behavior)
    return f"sqlite:///{(BACKEND_DIR / 'accommodation.db').as_posix()}"


def normalize_sqlite(url: str) -> str:
    """Make SQLite paths absolute and make sure parent folder exists."""
    u = make_url(url)
    if u.get_backend_name() != "sqlite":
        return url

    db_path = u.database or ""
    if db_path in ("", ":memory:"):
        return url

    p = Path(db_path)
    if not p.is_absolute():
        p = (Path.cwd() / p).resolve()
    p.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{p.as_posix()}"


# ---------- helpers ----------
def has_table(engine, name: str) -> bool:
    return inspect(engine).has_table(name)

def table_columns(engine, name: str) -> List[str]:
    insp = inspect(engine)
    return [c["name"] for c in insp.get_columns(name)] if has_table(engine, name) else []

def count_rows(engine, table: str) -> int:
    if not has_table(engine, table):
        return 0
    with engine.begin() as conn:
        try:
            return int(conn.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar() or 0)
        except Exception:
            # quoted fallback
            return int(conn.execute(text(f'SELECT COUNT(*) FROM "{table}"')).scalar() or 0)

def copy_if_needed(engine, src: str, dst: str, prefer_keys: Tuple[str, ...] = ("id", "file_no")) -> None:
    """
    Copy rows from legacy `src` into current `dst`.
    - Only copies if src exists and dst exists.
    - Copies only overlapping columns.
    - Skips duplicates using first available key in prefer_keys.
    - No-op if there's nothing to copy.
    """
    if not (has_table(engine, src) and has_table(engine, dst)):
        return

    src_cols = set(table_columns(engine, src))
    dst_cols = set(table_columns(engine, dst))
    common = [c for c in dst_cols.intersection(src_cols)]
    if not common:
        print(f"[migrate] {src} -> {dst}: no overlapping columns; skipped")
        return

    # choose a key to prevent duplicates
    key: Optional[str] = None
    for k in prefer_keys:
        if k in common:
            key = k
            break

    cols_list = ", ".join(common)
    with engine.begin() as conn:
        if key:
            # insert rows where the key is not already present in dst
            sql = f"""
                INSERT INTO {dst} ({cols_list})
                SELECT {cols_list}
                FROM {src} s
                WHERE NOT EXISTS (
                    SELECT 1 FROM {dst} d WHERE d.{key} = s.{key}
                )
            """
        else:
            # no safe key; do a blind insert (may duplicate)
            sql = f"INSERT INTO {dst} ({cols_list}) SELECT {cols_list} FROM {src}"
        try:
            result = conn.execute(text(sql))
            # result.rowcount can be -1 in some dialects; don't rely on it
            print(f"[migrate] {src} -> {dst}: attempted copy of common columns ({len(common)} cols)")
        except Exception as e:
            print(f"[migrate] {src} -> {dst}: ERROR: {e}")


def main() -> int:
    raw_url = resolve_db_url()
    db_url = normalize_sqlite(raw_url)

    print(f"[db] backend dir       : {BACKEND_DIR}")
    print(f"[db] resolved DB URL   : {db_url}")

    u = make_url(db_url)
    connect_args = {}
    if u.get_backend_name() == "sqlite":
        connect_args["check_same_thread"] = False

    engine = create_engine(db_url, pool_pre_ping=True, connect_args=connect_args)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    # 1) Ensure ORM tables exist (singular names)
    try:
        Base.metadata.create_all(bind=engine)
        print("[db] ensured ORM tables exist (Base.metadata.create_all)")
    except Exception as e:
        print(f"[db] create_all error: {e}")

    # 2) Migrate from legacy plural tables to singular ones (only if needed)
    migrations = [
        ("houses", "house", ("id", "file_no")),
        ("allotments", "allotment", ("id", "house_id")),
        ("file_movements", "file_movement", ("id", "file_no")),
        ("users", "user", ("id", "username")),
    ]

    for src, dst, keys in migrations:
        if has_table(engine, src) and has_table(engine, dst):
            before_src = count_rows(engine, src)
            before_dst = count_rows(engine, dst)
            copy_if_needed(engine, src, dst, keys)
            after_dst = count_rows(engine, dst)
            print(f"[check] {src}: {before_src} rows | {dst}: {before_dst} -> {after_dst} rows")

    # 3) Final visibility check (what your frontend cares about)
    for t in ("house", "allotment", "file_movement", "user"):
        print(f"[rows] {t:14s}: {count_rows(engine, t)}")

    # 4) Helpful note about Alembic
    print("\n[hint] If you still have old plural tables with data, keep them until you confirm "
          "the frontend sees rows. Then you can drop the old tables via a migration.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
