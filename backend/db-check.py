# backend/fix_db.py
from __future__ import annotations
import os, sys
from pathlib import Path
from typing import Dict, Iterable, Optional

from sqlalchemy import create_engine, text, inspect
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

# --- import path ---
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# --- app imports ---
from app.core.config import settings
from app.models.base import Base

# your models bind to singular tables:
# house, allotment, file_movement, user
# create_all() will ensure them.
def _resolve_db_url() -> str:
    if getattr(settings, "DB_URL", None):
        return settings.DB_URL
    for k in ("SQLALCHEMY_DATABASE_URL", "DATABASE_URL", "DB_URL"):
        v = os.getenv(k)
        if v:
            return v
    return f"sqlite:///{(BACKEND_DIR / 'accommodation.db').as_posix()}"

def _normalize_sqlite(url: str) -> str:
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

def _has_table(engine, name: str) -> bool:
    return inspect(engine).has_table(name)

def _cols(engine, name: str):
    return [c["name"] for c in inspect(engine).get_columns(name)]

def _count(engine, name: str) -> int:
    if not _has_table(engine, name):
        return 0
    with engine.begin() as conn:
        return int(conn.execute(text(f'SELECT COUNT(*) FROM "{name}"')).scalar() or 0)

def _safe_insert_from_select(engine, src: str, dst: str, colmap: Dict[str,str]) -> None:
    """
    Copy rows src -> dst mapping src_col -> dst_col via SELECT aliasing.
    Skips if src/dst missing. Ignores rows that would duplicate on a chosen key.
    """
    if not (_has_table(engine, src) and _has_table(engine, dst)):
        return
    src_cols = set(_cols(engine, src))
    dst_cols = set(_cols(engine, dst))
    # keep only pairs that actually exist on both sides
    pairs = [(s, d) for s, d in colmap.items() if s in src_cols and d in dst_cols]
    if not pairs:
        print(f"[migrate] {src} -> {dst}: no compatible columns; skipped")
        return

    # prefer a stable unique-ish key to avoid duplicates
    key: Optional[str] = None
    for cand in ("id", "username", "file_no", "house_id"):
        if any(d == cand for _, d in pairs) and cand in dst_cols:
            key = cand
            break

    select_list = ", ".join([f'{s} AS "{d}"' for s, d in pairs])
    dst_cols_sql = ", ".join([f'"{d}"' for _, d in pairs])

    with engine.begin() as conn:
        if key and any(d == key for _, d in pairs):
            sql = f"""
            INSERT INTO "{dst}" ({dst_cols_sql})
            SELECT {select_list}
            FROM "{src}" s
            WHERE NOT EXISTS (
                SELECT 1 FROM "{dst}" d WHERE d."{key}" = s."{key}"
            )
            """
        else:
            sql = f'INSERT INTO "{dst}" ({dst_cols_sql}) SELECT {select_list} FROM "{src}"'
        try:
            conn.execute(text(sql))
            print(f"[migrate] {src} -> {dst}: copied matching columns ({len(pairs)})")
        except Exception as e:
            print(f"[migrate] {src} -> {dst}: ERROR: {e}")

def main() -> int:
    raw = _resolve_db_url()
    url = _normalize_sqlite(raw)
    print(f"[db] using: {url}")

    connect_args = {}
    if make_url(url).get_backend_name() == "sqlite":
        connect_args["check_same_thread"] = False

    engine = create_engine(url, pool_pre_ping=True, connect_args=connect_args)
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

    # 1) ensure singular tables exist (your models bind to them)
    try:
        Base.metadata.create_all(bind=engine)
        print("[db] ensured tables exist via Base.metadata.create_all()")
    except Exception as e:
        print(f"[db] create_all error: {e}")

    # 2) migrate plural -> singular
    #    (adjusts for common column names; extra columns are ignored safely)
    migrations = [
        # houses -> house
        ("houses", "house", {
            "id":"id","file_no":"file_no","qtr_no":"qtr_no","block":"block","street":"street",
            "sector":"sector","type_code":"type_code","status":"status","status_manual":"status_manual"
        }),
        # allotments -> allotment
        ("allotments", "allotment", {
            "id":"id","house_id":"house_id","emp_name":"emp_name","emp_id":"emp_id",
            "department":"department","ministry":"ministry","designation":"designation",
            "allotment_date":"allotment_date","possession_date":"possession_date",
            "vacation_date":"vacation_date","retention_from":"retention_from",
            "retention_until":"retention_until","retention_last":"retention_last",
            "qtr_status":"qtr_status","allottee_status":"allottee_status","notes":"notes"
        }),
        # file_movements -> file_movement
        ("file_movements", "file_movement", {
            "id":"id","file_no":"file_no","date":"date","office":"office","to_person":"to_person",
            "remarks":"remarks"
        }),
        # users -> user  <<< THIS IS THE IMPORTANT ONE
        ("users", "user", {
            "id":"id",
            "username":"username",
            "email":"email",
            "full_name":"full_name",
            # handle common legacy names -> new field
            "hashed_password":"hashed_password",
            "password_hash":"hashed_password",
            "is_active":"is_active",
            "role":"role",
            "permissions":"permissions"
        }),
    ]

    for src, dst, cmap in migrations:
        if _has_table(engine, src) and _has_table(engine, dst):
            before_dst = _count(engine, dst)
            _safe_insert_from_select(engine, src, dst, cmap)
            after_dst = _count(engine, dst)
            print(f"[check] {src} -> {dst}: {before_dst} -> {after_dst} rows")

    # 3) final row counts that the frontend/API will read
    for t in ("house", "allotment", "file_movement", "user"):
        print(f"[rows] {t:14s}: {_count(engine, t)}")

    print("\nDone. Your app reads users from the **user** table.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
