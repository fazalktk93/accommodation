#!/usr/bin/env python3
"""
Import houses from CSV into the database, safely and idempotently.

- Reads DATABASE_URL from .env (fallbacks to SQLite).
- Accepts a --csv path.
- Upserts by unique key (defaults to file_no, then (file_no,qtr_no) if file_no is missing).
- Cleans and normalizes values.
- Logs per-row errors to import_errors.csv but keeps going.
- Wraps in small transactions (batch size) to avoid locking.
"""

import argparse, csv, os, sys, re, time
from contextlib import contextmanager
from typing import Dict, Any, Iterable, List, Tuple

# --- Load .env if present (optional)
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

from sqlalchemy import create_engine, MetaData, Table, select, update, insert, and_, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError

# ---------- Helpers

def env(key: str, default: str = "") -> str:
    return os.environ.get(key) or default

def normalize_row(row: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize and sanitize a CSV row to our canonical schema."""
    def s(v):  # stringify and strip
        if v is None:
            return ""
        return str(v).strip()

    out = {
        "file_no": s(row.get("file_no") or row.get("File No")),
        "qtr_no":  s(row.get("qtr_no")  or row.get("Qtr No")),
        "sector":  s(row.get("sector")  or row.get("Sector")).upper(),
        "street":  s(row.get("street")  or row.get("Street")),  # may be empty
        "type_code": s(row.get("type_code") or row.get("type") or row.get("Accomodation type")).upper(),
        # Prefer Qtr Status over File Status if present in the original row
        "status": s(row.get("status") or row.get("Qtr Status") or row.get("File Status")).lower(),
    }

    # Tighten status & type_code to known sets (soft mapping)
    status_map = {
        "available":"available","vacant":"vacant","occupied":"occupied","reserved":"reserved",
        "maintenance":"maintenance","other":"other","issue_in_record":"issue_in_record","issue in record":"issue_in_record",
        "missing":"missing","ended":"vacant","active":"occupied"  # common crossovers
    }
    if out["status"]:
        out["status"] = status_map.get(out["status"], out["status"])

    if out["type_code"]:
        out["type_code"] = re.sub(r"[^A-Z]", "", out["type_code"])[:1]  # keep first letter A..H if you like

    # Blank strings -> None
    for k, v in list(out.items()):
        if isinstance(v, str) and v == "":
            out[k] = None

    return out

@contextmanager
def session(engine: Engine):
    conn = engine.connect()
    trans = conn.begin()
    try:
        yield conn
        trans.commit()
    except Exception:
        trans.rollback()
        raise
    finally:
        conn.close()

def ensure_table(meta: MetaData, engine: Engine, table_name: str = "houses") -> Table:
    meta.reflect(bind=engine, only=[table_name])
    if table_name not in meta.tables:
        raise RuntimeError(f"Table '{table_name}' not found in DB. Is your app migrated?")
    return meta.tables[table_name]

def upsert_house(conn, table: Table, row: Dict[str, Any], unique_by: Tuple[str, ...]) -> None:
    """Upsert by the given unique key (tuple of column names)."""
    filters = []
    for k in unique_by:
        filters.append((k, row.get(k)))
    # If all unique key parts are missing, do nothing
    if not any(v for _, v in filters):
        return

    # Build where clause
    conds = [ (table.c[k] == v) for k, v in filters if v is not None ]
    if not conds:
        return
    stmt_sel = select(table.c.id).where(and_(*conds)).limit(1)
    existing = conn.execute(stmt_sel).fetchone()

    # Only include known columns
    raw_payload = {k: row.get(k) for k in ("file_no", "qtr_no", "sector", "street", "type_code", "status") if k in table.c}

    existing = conn.execute(stmt_sel).fetchone()

    if existing:
        # ✅ DO NOT overwrite with None: drop keys whose value is None
        payload = {k: v for k, v in raw_payload.items() if v is not None}
        if payload:  # update only if there’s something to change
            stmt = update(table).where(table.c.id == existing[0]).values(**payload)
            conn.execute(stmt)
    else:
        # For INSERT, you can either insert None or set defaults here if needed
        stmt = insert(table).values(**raw_payload)
        conn.execute(stmt)

def read_csv_rows(csv_path: str) -> Iterable[Dict[str, Any]]:
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            yield row

# ---------- Main

def main():
    parser = argparse.ArgumentParser(description="Import houses CSV into DB safely")
    parser.add_argument("--csv", required=True, help="Path to CSV file (headers: file_no,qtr_no,sector,street,type_code,status)")
    parser.add_argument("--table", default="houses", help="Table name (default: houses)")
    parser.add_argument("--unique", nargs="+", default=["file_no"], help="Unique key columns (default: file_no). Falls back to (file_no,qtr_no) if file_no is missing.")
    parser.add_argument("--batch", type=int, default=500, help="Commit every N rows (default: 500)")
    parser.add_argument("--db", default=None, help="DB URL override (else read from .env)")
    parser.add_argument("--dry", action="store_true", help="Dry-run (no writes)")
    args = parser.parse_args()

    db_url = args.db or env("DATABASE_URL") or env("SQLALCHEMY_DATABASE_URI") or "sqlite:///./app.db"
    engine = create_engine(db_url, future=True)

    meta = MetaData()
    table = ensure_table(meta, engine, args.table)

    errors: List[Tuple[int, str]] = []
    total = 0
    written = 0
    t0 = time.time()

    batch = []
    for i, raw in enumerate(read_csv_rows(args.csv), start=1):
        total += 1
        try:
            row = normalize_row(raw)
            # choose unique key for this row
            unique_by = tuple(args.unique)
            if (not row.get("file_no")) and row.get("qtr_no"):
                unique_by = ("file_no", "qtr_no")  # allow matching by both where file_no may be blank initially
            batch.append((row, unique_by))
        except Exception as e:
            errors.append((i, f"normalize: {e}"))

        # flush batch
        if len(batch) >= args.batch:
            try:
                if not args.dry:
                    with session(engine) as conn:
                        for row, unique_by in batch:
                            upsert_house(conn, table, row, unique_by)
                written += len(batch)
                batch.clear()
            except SQLAlchemyError as e:
                # log the whole batch as one error, but continue
                errors.append((i, f"DB batch error: {e}"))
                batch.clear()

    # final batch
    if batch:
        try:
            if not args.dry:
                with session(engine) as conn:
                    for row, unique_by in batch:
                        upsert_house(conn, table, row, unique_by)
            written += len(batch)
        except SQLAlchemyError as e:
            errors.append((total, f"DB final batch error: {e}"))

    # write error log
    if errors:
        err_path = "import_errors.csv"
        with open(err_path, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["row_number", "error"])
            w.writerows(errors)
        print(f"[WARN] Completed with {len(errors)} row errors. See {err_path}")
    else:
        print("[OK] Completed with 0 row errors.")

    dt = time.time() - t0
    print(f"Rows read: {total}, rows processed: {written}, time: {dt:.1f}s, dry-run: {args.dry}")
    print("Done.")

if __name__ == "__main__":
    main()
