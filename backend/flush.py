#!/usr/bin/env python3
"""
Clean/normalize data in the 'houses' table safely.

- Backs up the table (CREATE TABLE houses_backup_YYYYMMDDHHMMSS AS SELECT * FROM houses)
- Normalizes fields: file_no, qtr_no, sector, street, type_code, status
- Converts blank strings -> NULL
- Maps status variants to a canonical set
- Coerces type_code to one letter A..H
- Works with SQLite/Postgres (SQLAlchemy)
- Idempotent; safe to re-run
"""

import argparse, csv, os, re, sys, time, datetime as dt
from typing import Any, Dict, Optional, Tuple, List

# Optional .env support
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

from sqlalchemy import (
    create_engine, MetaData, Table, select, update, text
)
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError

# ------------------ Normalizers ------------------

STATUS_MAP = {
    # canonical
    "available": "available",
    "vacant": "vacant",
    "occupied": "occupied",
    "reserved": "reserved",
    "maintenance": "maintenance",
    "other": "other",
    "issue_in_record": "issue_in_record",
    "missing": "missing",
    # common variants
    "issue in record": "issue_in_record",
    "issue-in-record": "issue_in_record",
    "issues in record": "issue_in_record",
    "ended": "vacant",
    "active": "occupied",
    "null": None,
    "none": None,
    "": None,
}

TYPE_ALLOWED = set(list("ABCDEFGH"))

def norm_str(v: Any) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    return s if s else None

def norm_sector(v: Any) -> Optional[str]:
    s = norm_str(v)
    if s is None:
        return None
    s = s.upper()
    # common “Site” capitalization
    if s.lower() == "site":
        return "SITE"
    return s

def norm_qtr_no(v: Any) -> Optional[str]:
    s = norm_str(v)
    if s is None:
        return None
    # collapse internal spaces around hyphens (e.g., "465 - B" -> "465-B")
    s = re.sub(r"\s*-\s*", "-", s)
    # collapse multiple spaces
    s = re.sub(r"\s+", " ", s)
    return s

def norm_type_code(v: Any) -> Optional[str]:
    s = norm_str(v)
    if s is None:
        return None
    s = s.upper()
    # keep only letters
    s = re.sub(r"[^A-Z]", "", s)
    if not s:
        return None
    # take the first letter (A..H), else None
    t = s[0]
    return t if t in TYPE_ALLOWED else None

def norm_status(v: Any) -> Optional[str]:
    s = norm_str(v)
    if s is None:
        return None
    key = s.lower().replace("-", " ").strip()
    key = re.sub(r"\s+", " ", key)
    return STATUS_MAP.get(key, key)  # if unknown, keep lowercased key

def blanks_to_none(payload: Dict[str, Any]) -> Dict[str, Any]:
    out = {}
    for k, v in payload.items():
        if isinstance(v, str) and v.strip() == "":
            out[k] = None
        else:
            out[k] = v
    return out

# ------------------ DB helpers ------------------

def get_db_url(cli_db: Optional[str]) -> str:
    env_url = os.getenv("DATABASE_URL") or os.getenv("SQLALCHEMY_DATABASE_URI")
    return cli_db or env_url or "sqlite:///./app.db"

def reflect_table(engine: Engine, name: str) -> Table:
    meta = MetaData()
    meta.reflect(bind=engine, only=[name])
    if name not in meta.tables:
        raise RuntimeError(f"Table '{name}' not found in DB.")
    return meta.tables[name]

def backup_table(engine: Engine, table_name: str) -> str:
    ts = dt.datetime.now().strftime("%Y%m%d%H%M%S")
    backup = f"{table_name}_backup_{ts}"
    with engine.begin() as conn:
        # SQLite/Postgres compatible
        conn.execute(text(f'CREATE TABLE "{backup}" AS SELECT * FROM "{table_name}"'))
    return backup

# ------------------ Cleaner ------------------

def clean_houses(engine: Engine, table_name: str, batch: int, dry: bool, keep_unknown_status: bool) -> Tuple[int, int, int]:
    table = reflect_table(engine, table_name)
    # Determine which columns exist
    cols = table.c.keys()
    has = {c: (c in cols) for c in ["file_no", "qtr_no", "sector", "street", "type_code", "status"]}

    # Pull only needed columns + id
    select_cols = [table.c.id]
    for c in ["file_no", "qtr_no", "sector", "street", "type_code", "status"]:
        if has[c]:
            select_cols.append(getattr(table.c, c))

    total = 0
    updated = 0
    errors: List[Tuple[int, str]] = []

    # Stream all rows; for SQLite this is fine, for Postgres also OK
    with engine.connect() as conn:
        res = conn.execute(select(*select_cols))
        rows = res.fetchall()

    def cleaned_payload(row_dict: Dict[str, Any]) -> Dict[str, Any]:
        payload: Dict[str, Any] = {}
        if has["file_no"]:
            payload["file_no"] = norm_str(row_dict.get("file_no"))
        if has["qtr_no"]:
            payload["qtr_no"] = norm_qtr_no(row_dict.get("qtr_no"))
        if has["sector"]:
            payload["sector"] = norm_sector(row_dict.get("sector"))
        if has["street"]:
            payload["street"] = norm_str(row_dict.get("street"))
        if has["type_code"]:
            payload["type_code"] = norm_type_code(row_dict.get("type_code"))
        if has["status"]:
            st = norm_status(row_dict.get("status"))
            # If you want to keep unknown statuses as-is (not lowercased), toggle via flag
            if keep_unknown_status and st not in STATUS_MAP.values() and st is not None:
                st = row_dict.get("status")
            payload["status"] = st
        payload = blanks_to_none(payload)
        return payload

    # Batch updates
    to_update: List[Tuple[int, Dict[str, Any]]] = []
    for r in rows:
        total += 1
        rd = dict(r._mapping)  # row to dict
        rid = rd["id"]
        desired = cleaned_payload(rd)

        # Only update if something would change
        diff = {}
        for k, newv in desired.items():
            if k not in rd:
                continue
            oldv = rd.get(k)
            # Normalize oldv’s None/blank for comparison
            old_norm = (None if (oldv is None or (isinstance(oldv, str) and oldv.strip() == "")) else oldv)
            if old_norm != newv:
                diff[k] = newv

        if diff:
            to_update.append((rid, diff))

        if len(to_update) >= batch:
            try:
                if not dry and to_update:
                    with engine.begin() as conn:
                        for rid2, diff2 in to_update:
                            stmt = update(table).where(table.c.id == rid2).values(**diff2)
                            conn.execute(stmt)
                updated += len(to_update)
                to_update.clear()
            except SQLAlchemyError as e:
                errors.append((rid, f"DB batch error: {e}"))
                to_update.clear()

    # final flush
    if to_update:
        try:
            if not dry:
                with engine.begin() as conn:
                    for rid2, diff2 in to_update:
                        stmt = update(table).where(table.c.id == rid2).values(**diff2)
                        conn.execute(stmt)
            updated += len(to_update)
        except SQLAlchemyError as e:
            errors.append((to_update[-1][0], f"DB final batch error: {e}"))

    # dump errors
    if errors:
        with open("clean_errors.csv", "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["row_id", "error"])
            w.writerows(errors)

    return total, updated, len(errors)

# ------------------ CLI ------------------

def main():
    ap = argparse.ArgumentParser(description="Clean/normalize 'houses' table safely.")
    ap.add_argument("--db", default=None, help="DB URL (e.g., sqlite:////abs/path/app.db). Defaults to env DATABASE_URL/SQLALCHEMY_DATABASE_URI or sqlite:///./app.db")
    ap.add_argument("--table", default="houses", help="Table name (default: houses)")
    ap.add_argument("--batch", type=int, default=500, help="Update batch size (default 500)")
    ap.add_argument("--dry", action="store_true", help="Dry run (no writes)")
    ap.add_argument("--no-backup", action="store_true", help="Skip creating backup table")
    ap.add_argument("--keep-unknown-status", action="store_true", help="Keep unrecognized status values as-is")
    args = ap.parse_args()

    db_url = get_db_url(args.db)
    engine = create_engine(db_url, future=True)

    # Ensure table exists
    try:
        reflect_table(engine, args.table)
    except RuntimeError as e:
        print(f"[FATAL] {e}")
        sys.exit(1)

    # Backup (unless skipped)
    backup_name = None
    if not args.no_backup and not args.dry:
        try:
            backup_name = backup_table(engine, args.table)
            print(f"[OK] Backup created: {backup_name}")
        except SQLAlchemyError as e:
            print(f"[WARN] Could not create backup: {e}")

    t0 = time.time()
    total, updated, err_count = clean_houses(
        engine,
        table_name=args.table,
        batch=args.batch,
        dry=args.dry,
        keep_unknown_status=args.keep_unknown_status,
    )
    dt = time.time() - t0

    print(f"[DONE] Rows scanned: {total}, rows updated: {updated}, errors: {err_count}, time: {dt:.1f}s, dry={args.dry}")
    if err_count:
        print("See clean_errors.csv for details.")

if __name__ == "__main__":
    main()
