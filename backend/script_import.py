#!/usr/bin/env python3
"""
Smart CSV importer for the 'house' table.
- Autodetects column names like: "File No", "Qtr No", "Accomodation type", "Qtr Status", etc.
- Upsert by (--unique file_no qtr_no) by default.
- Reports inserted / updated / skipped (with reason).
- Works on SQLite/Postgres. No CORS (server-side).
"""

import argparse, csv, os, re
from typing import Dict, Any, List, Tuple, Optional
from sqlalchemy import create_engine, MetaData, Table, select, update, insert, and_, text
from sqlalchemy.engine import Engine

# ---- column detection ----
def norm(s: str) -> str:
    s = (s or "").strip().lower()
    s = re.sub(r'[\s_]+', ' ', s)
    return s

def map_columns(header: List[str]) -> Dict[str, str]:
    """Return a mapping CSV_col -> std_name for std: file_no,qtr_no,sector,street,type_code,status."""
    out = {}
    for col in header:
        key = norm(col)
        # file_no
        if re.search(r'\bfile\b', key) and re.search(r'\b(no|number|#)\b', key):
            out[col] = 'file_no'; continue
        if key in ('file', 'file no', 'file #', 'file number'):
            out[col] = 'file_no'; continue
        # qtr_no
        if ('qtr' in key or 'quarter' in key) and ('no' in key or 'number' in key or '#' in key):
            out[col] = 'qtr_no'; continue
        if key in ('qtr', 'quarter', 'qtr no', 'quarter no', 'qtr #', 'quarter #'):
            out[col] = 'qtr_no'; continue
        # sector
        if 'sector' in key:
            out[col] = 'sector'; continue
        # street
        if 'street' in key:
            out[col] = 'street'; continue
        # type_code (accommodation/accomodation/type)
        if 'accommodation' in key or 'accomodation' in key or key == 'type' or 'type' in key:
            out[col] = 'type_code'; continue
        # status (qtr status / file status)
        if 'status' in key:
            out[col] = 'status'; continue
    return out

# ---- normalizers ----
STATUS_MAP = {
    "available":"available","vacant":"vacant","occupied":"occupied","reserved":"reserved",
    "maintenance":"maintenance","other":"other","issue_in_record":"issue_in_record","missing":"missing",
    "issue in record":"issue_in_record","issue-in-record":"issue_in_record","issues in record":"issue_in_record",
    "ended":"vacant","active":"occupied",
}
def clean(s: Any) -> Optional[str]:
    if s is None: return None
    s = str(s).strip()
    return s or None
def clean_sector(s: Any) -> Optional[str]:
    s = clean(s)
    if not s: return None
    u = s.upper()
    return "SITE" if u.lower()=="site" else u
def clean_qtr(s: Any) -> Optional[str]:
    s = clean(s)
    if not s: return None
    s = re.sub(r"\s*-\s*", "-", s)
    s = re.sub(r"\s+", " ", s)
    return s
def clean_type(s: Any) -> Optional[str]:
    s = clean(s)
    if not s: return None
    s = re.sub(r"[^A-Za-z]", "", s.upper())
    return s[:1] if s else None
def clean_status(s: Any) -> Optional[str]:
    s = clean(s)
    if not s: return None
    key = re.sub(r"\s+", " ", s.lower().replace("-", " ").strip())
    return STATUS_MAP.get(key, key)

# ---- DB helpers ----
def reflect_table(engine: Engine, name: str) -> Table:
    meta = MetaData()
    meta.reflect(bind=engine, only=[name])
    if name not in meta.tables:
        raise RuntimeError(f"Table '{name}' not found in DB.")
    return meta.tables[name]

def upsert(conn, table: Table, row: Dict[str, Any], unique_by: Tuple[str, ...]) -> str:
    # build where by keys
    conds = []
    for k in unique_by:
        v = row.get(k)
        if v is None:  # missing key
            return "skip_nokey"
        conds.append(table.c[k] == v)
    sel = select(table.c.id).where(and_(*conds)).limit(1)
    hit = conn.execute(sel).fetchone()
    payload = {k: row.get(k) for k in row.keys() if k in table.c}

    if hit:
        # Only update changed fields (simple)
        stmt = update(table).where(table.c.id==hit[0]).values(**payload)
        conn.execute(stmt)
        return "update"
    else:
        stmt = insert(table).values(**payload)
        conn.execute(stmt)
        return "insert"

def main():
    ap = argparse.ArgumentParser(description="Smart import for house table")
    ap.add_argument("--csv", required=True, help="Path to CSV (any header names; autodetected).")
    ap.add_argument("--db", default=None, help="DB URL, e.g. sqlite:////abs/path/accommodation.db")
    ap.add_argument("--table", default="house", help="Table name (default: house)")
    ap.add_argument("--unique", nargs="+", default=["file_no","qtr_no"], help="Unique keys (default: file_no qtr_no)")
    ap.add_argument("--batch", type=int, default=1000, help="Batch size")
    ap.add_argument("--dry", action="store_true", help="Dry run (no writes)")
    args = ap.parse_args()

    db_url = args.db or os.getenv("DATABASE_URL") or os.getenv("SQLALCHEMY_DATABASE_URI") or "sqlite:///./accommodation.db"
    engine = create_engine(db_url, future=True)
    table = reflect_table(engine, args.table)

    # Read CSV
    with open(args.csv, newline='', encoding='utf-8-sig') as f:
        rdr = csv.reader(f)
        header = next(rdr, [])
        if not header:
            print("[FATAL] Empty CSV.")
            return
        mapping = map_columns(header)

        print("Detected header mapping:")
        for c in header:
            print(f"  {c!r} -> {mapping.get(c, '(ignored)')}")

        # indexes of cols we care about
        idx = {std: header.index(src) for src, std in mapping.items()}

        inserts=updates=skip_nokey=skip_allblank=0
        batch = []
        def flush_batch():
            nonlocal inserts, updates
            if not batch: return
            with engine.begin() as conn:
                for row in batch:
                    res = upsert(conn, table, row, tuple(args.unique))
                    if res=="insert": inserts+=1
                    elif res=="update": updates+=1
            batch.clear()

        for raw in rdr:
            # build normalized row
            row: Dict[str, Any] = {}
            # Get raw values
            rv = lambda k: raw[idx[k]] if k in idx and idx[k] < len(raw) else None
            file_no = clean(rv('file_no'))
            qtr_no  = clean_qtr(rv('qtr_no'))
            sector  = clean_sector(rv('sector'))
            street  = clean(rv('street'))
            type_cd = clean_type(rv('type_code'))
            status  = clean_status(rv('status'))

            # If totally blank, skip
            if not any([file_no, qtr_no, sector, street, type_cd, status]):
                skip_allblank += 1
                continue

            row.update({
                'file_no': file_no,
                'qtr_no': qtr_no,
                'sector': sector,
                'street': street,
                'type_code': type_cd,
                'status': status,
            })

            # Ensure unique key present
            if not all(row.get(k) for k in args.unique):
                skip_nokey += 1
                continue

            batch.append(row)
            if len(batch) >= args.batch and
