#!/usr/bin/env python3
import argparse, csv, os, re
from typing import Dict, Any, List, Tuple, Optional
from sqlalchemy import create_engine, MetaData, Table, select, update, insert, and_, text
from sqlalchemy.engine import Engine

# ---------- column detection ----------
def _norm(s: str) -> str:
    s = (s or "").strip().lower()
    s = re.sub(r'[\s_]+', ' ', s)
    return s

def map_columns(header: List[str]) -> Dict[str, str]:
    """Map CSV header -> std name (file_no,qtr_no,sector,street,type_code,status)."""
    out = {}
    for col in header:
        key = _norm(col)
        # file_no
        if (re.search(r'\bfile\b', key) and re.search(r'\b(no|number|#)\b', key)) or key in ('file','file no','file #','file number'):
            out[col] = 'file_no'; continue
        # qtr_no
        if (('qtr' in key or 'quarter' in key) and ('no' in key or 'number' in key or '#' in key)) or key in ('qtr','quarter','qtr no','quarter no','qtr #','quarter #'):
            out[col] = 'qtr_no'; continue
        # sector
        if 'sector' in key:
            out[col] = 'sector'; continue
        # street
        if 'street' in key:
            out[col] = 'street'; continue
        # type_code
        if 'accommodation' in key or 'accomodation' in key or key == 'type' or 'type' in key:
            out[col] = 'type_code'; continue
        # status
        if 'status' in key:
            out[col] = 'status'; continue
    return out

# ---------- normalizers ----------
STATUS_MAP = {
    "available":"available","vacant":"vacant","occupied":"occupied","reserved":"reserved",
    "maintenance":"maintenance","other":"other","issue_in_record":"issue_in_record","missing":"missing",
    "issue in record":"issue_in_record","issue-in-record":"issue_in_record","issues in record":"issue_in_record",
    "ended":"vacant","active":"occupied",
}
def _clean(v: Any) -> Optional[str]:
    if v is None: return None
    s = str(v).strip()
    return s or None
def _sector(v: Any) -> Optional[str]:
    s = _clean(v)
    if not s: return None
    u = s.upper()
    return "SITE" if u.lower()=="site" else u
def _qtr(v: Any) -> Optional[str]:
    s = _clean(v)
    if not s: return None
    s = re.sub(r"\s*-\s*", "-", s)
    s = re.sub(r"\s+", " ", s)
    return s
def _type(v: Any) -> Optional[str]:
    s = _clean(v)
    if not s: return None
    s = re.sub(r"[^A-Za-z]", "", s.upper())
    return s[:1] if s else None
def _status(v: Any) -> Optional[str]:
    s = _clean(v)
    if not s: return None
    key = re.sub(r"\s+", " ", s.lower().replace("-", " ").strip())
    return STATUS_MAP.get(key, key)

# ---------- db helpers ----------
def reflect_table(engine: Engine, name: str) -> Table:
    meta = MetaData()
    meta.reflect(bind=engine, only=[name])
    if name not in meta.tables:
        raise RuntimeError(f"Table '{name}' not found in DB.")
    return meta.tables[name]

def upsert(conn, table: Table, row: Dict[str, Any], unique_by: Tuple[str, ...]) -> str:
    conds = []
    for k in unique_by:
        v = row.get(k)
        if v is None:
            return "skip_nokey"
        conds.append(table.c[k] == v)
    hit = conn.execute(select(table.c.id).where(and_(*conds)).limit(1)).fetchone()
    payload = {k: row.get(k) for k in row.keys() if k in table.c}
    if hit:
        conn.execute(update(table).where(table.c.id == hit[0]).values(**payload))
        return "update"
    else:
        conn.execute(insert(table).values(**payload))
        return "insert"

def main():
    ap = argparse.ArgumentParser(description="Smart import for house table")
    ap.add_argument("--csv", required=True, help="Path to CSV")
    ap.add_argument("--db", default=None, help="DB URL (e.g., sqlite:////abs/path/accommodation.db)")
    ap.add_argument("--table", default="house", help="Table name (default: house)")
    ap.add_argument("--unique", nargs="+", default=["file_no","qtr_no"], help="Unique keys (default: file_no qtr_no)")
    ap.add_argument("--batch", type=int, default=1000, help="Batch size")
    ap.add_argument("--dry", action="store_true", help="Dry run (no writes)")
    args = ap.parse_args()

    db_url = args.db or os.getenv("DATABASE_URL") or os.getenv("SQLALCHEMY_DATABASE_URI") or "sqlite:///./accommodation.db"
    engine = create_engine(db_url, future=True)
    table = reflect_table(engine, args.table)

    # read CSV
    with open(args.csv, newline='', encoding='utf-8-sig') as f:
        rdr = csv.reader(f)
        header = next(rdr, [])
        if not header:
            print("[FATAL] Empty CSV."); return
        mapping = map_columns(header)

        print("Detected header mapping:")
        for c in header:
            print(f"  {c!r} -> {mapping.get(c, '(ignored)')}")

        idx = {std: header.index(src) for src, std in mapping.items()}

        inserts=updates=skip_nokey=skip_allblank=0
        batch: List[Dict[str, Any]] = []

        def flush_batch():
            nonlocal inserts, updates
            if not batch: return
            with engine.begin() as conn:
                for row in batch:
                    res = upsert(conn, table, row, tuple(args.unique))
                    if res == "insert": inserts += 1
                    elif res == "update": updates += 1
            batch.clear()

        for raw in rdr:
            rv = lambda k: (raw[idx[k]] if k in idx and idx[k] < len(raw) else None)

            row: Dict[str, Any] = {
                'file_no':   _clean(rv('file_no')),
                'qtr_no':    _qtr(rv('qtr_no')),
                'sector':    _sector(rv('sector')),
                'street':    _clean(rv('street')),
                'type_code': _type(rv('type_code')),
                'status':    _status(rv('status')),
            }

            if not any(row.values()):
                skip_allblank += 1
                continue

            # require unique keys present
            if not all(row.get(k) for k in args.unique):
                skip_nokey += 1
                continue

            batch.append(row)

            # ✅ this is the line that broke for you — keep it on one line
            if len(batch) >= args.batch and not args.dry:
                flush_batch()

        if batch and not args.dry:
            flush_batch()

        print(f"[RESULT] inserts={inserts}, updates={updates}, skipped_no_key={skip_nokey}, skipped_all_blank={skip_allblank}")

if __name__ == "__main__":
    main()
