#!/usr/bin/env python3
import argparse, csv, os, re
from typing import Dict, Any, List, Tuple, Optional
from sqlalchemy import create_engine, MetaData, Table, select, update, insert, and_
from sqlalchemy.engine import Engine

# ---------- helpers ----------
def _norm(s: str) -> str:
    s = (s or "").strip().lower()
    s = re.sub(r'[\s_]+', ' ', s)
    return s

def map_columns(header: List[str]) -> Dict[str, str]:
    out = {}
    for col in header:
        key = _norm(col)
        if (re.search(r'\bfile\b', key) and re.search(r'\b(no|number|#)\b', key)) or key in ('file','file no','file #','file number'):
            out[col] = 'file_no'; continue
        if (('qtr' in key or 'quarter' in key) and ('no' in key or 'number' in key or '#' in key)) or key in ('qtr','quarter','qtr no','quarter no','qtr #','quarter #'):
            out[col] = 'qtr_no'; continue
        if 'sector' in key:
            out[col] = 'sector'; continue
        if 'street' in key:
            out[col] = 'street'; continue
        if 'accommodation' in key or 'accomodation' in key or key == 'type' or 'type' in key:
            out[col] = 'type_code'; continue
        if 'status' in key:
            out[col] = 'status'; continue
    return out

STATUS_MAP = {
    "available":"available","vacant":"vacant","occupied":"occupied","reserved":"reserved",
    "maintenance":"maintenance","other":"other","issue_in_record":"issue_in_record","missing":"missing",
    "issue in record":"issue_in_record","issue-in-record":"issue_in_record","issues in record":"issue_in_record",
    "ended":"vacant","active":"occupied",
}

def _clean(v: Any) -> Optional[str]:
    if v is None: return None
    s = str(v).strip()
    return s if s != "" else None

def _sector(v: Any) -> Optional[str]:
    s = _clean(v)
    return s.upper() if s else None

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

def _status(v: Any, keep_empty: bool) -> Optional[str]:
    # keep "" if requested to satisfy NOT NULL without a default
    if v is None:
        return "" if keep_empty else None
    s = str(v).strip()
    if s == "":
        return "" if keep_empty else None
    key = re.sub(r"\s+", " ", s.lower().replace("-", " ").strip())
    return STATUS_MAP.get(key, key)

# ---------- db ----------
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
    ap = argparse.ArgumentParser(description="Smart import for house table (headerless, column order, keep-empty status).")
    ap.add_argument("--csv", required=True)
    ap.add_argument("--db", default=None)
    ap.add_argument("--table", default="house")
    ap.add_argument("--unique", nargs="+", default=["file_no","qtr_no"])
    ap.add_argument("--batch", type=int, default=1000)
    ap.add_argument("--dry", action="store_true")
    # headerless support
    ap.add_argument("--no-header", action="store_true", help="CSV has no header row")
    ap.add_argument("--order", default="", help="Comma list when --no-header (e.g., file_no,qtr_no,street,sector,status,type_code)")
    # keep-empty controls
    ap.add_argument("--keep-empty-status", action="store_true", help="Keep empty string for status (avoid NOT NULL failure)")
    # preview
    ap.add_argument("--peek", type=int, default=0, help="Print first N parsed rows then exit")
    args = ap.parse_args()

    db_url = args.db or os.getenv("DATABASE_URL") or os.getenv("SQLALCHEMY_DATABASE_URI") or "sqlite:///./accommodation.db"
    engine = create_engine(db_url, future=True)
    table = reflect_table(engine, args.table)

    def build_row_from_list(vals: List[str], order: List[str]) -> Dict[str, Any]:
        def get(key):
            i = order.index(key) if key in order else -1
            return vals[i] if (i >= 0 and i < len(vals)) else None
        return {
            'file_no':   _clean(get('file_no')),
            'qtr_no':    _qtr(get('qtr_no')),
            'sector':    _sector(get('sector')),
            'street':    _clean(get('street')),
            'type_code': _type(get('type_code')),
            'status':    _status(get('status'), keep_empty=args.keep_empty_status),
        }

    inserts=updates=skip_nokey=skip_allblank=0
    batch_rows: List[Dict[str, Any]] = []

    def flush_batch():
        nonlocal inserts, updates
        if not batch_rows: return
        with engine.begin() as conn:
            for row in batch_rows:
                res = upsert(conn, table, row, tuple(args.unique))
                if res == "insert": inserts += 1
                elif res == "update": updates += 1
        batch_rows.clear()

    with open(args.csv, newline='', encoding='utf-8-sig') as f:
        rdr = csv.reader(f)
        if args.no_header:
            if not args.order:
                raise SystemExit("When using --no-header you must pass --order")
            order = [x.strip() for x in args.order.split(",") if x.strip()]
            shown = 0
            for raw in rdr:
                row = build_row_from_list(raw, order)
                if not any(v not in (None, "") for v in row.values()):  # all None or ""
                    skip_allblank += 1
                    continue
                if not all(row.get(k) for k in args.unique):
                    skip_nokey += 1
                    continue
                if args.peek and shown < args.peek:
                    print("[PEEK]", row); shown += 1
                    if shown >= args.peek:
                        print("[INFO] Peek complete."); return
                batch_rows.append(row)
                if len(batch_rows) >= args.batch and not args.dry:
                    flush_batch()
        else:
            header = next(rdr, [])
            mapping = map_columns(header)
            idx = {std: header.index(src) for src, std in mapping.items()}
            shown = 0
            print("Detected header mapping:")
            for c in header:
                print(f"  {c!r} -> {mapping.get(c, '(ignored)')}")
            for raw in rdr:
                rv = lambda k: (raw[idx[k]] if k in idx and idx[k] < len(raw) else None)
                row = {
                    'file_no':   _clean(rv('file_no')),
                    'qtr_no':    _qtr(rv('qtr_no')),
                    'sector':    _sector(rv('sector')),
                    'street':    _clean(rv('street')),
                    'type_code': _type(rv('type_code')),
                    'status':    _status(rv('status'), keep_empty=args.keep_empty_status),
                }
                if not any(v not in (None, "") for v in row.values()):
                    skip_allblank += 1
                    continue
                if not all(row.get(k) for k in args.unique):
                    skip_nokey += 1
                    continue
                if args.peek and shown < args.peek:
                    print("[PEEK]", row); shown += 1
                    if shown >= args.peek:
                        print("[INFO] Peek complete."); return
                batch_rows.append(row)
                if len(batch_rows) >= args.batch and not args.dry:
                    flush_batch()

    if batch_rows and not args.dry:
        flush_batch()

    print(f"[RESULT] inserts={inserts}, updates={updates}, skipped_no_key={skip_nokey}, skipped_all_blank={skip_allblank}")

if __name__ == "__main__":
    main()
