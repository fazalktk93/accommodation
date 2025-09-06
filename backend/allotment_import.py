#!/usr/bin/env python3
import argparse, csv, os, re
from typing import Dict, Any, List, Tuple, Optional
from datetime import datetime, date

from sqlalchemy import (
    create_engine, MetaData, Table, select, update, insert, and_, text, inspect
)
from sqlalchemy.engine import Engine
from sqlalchemy.sql.sqltypes import Date as SA_Date, DateTime, String as SA_String

# ----------------- tiny helpers -----------------
def _clean(v: Any) -> Optional[str]:
    if v is None: return None
    s = str(v).strip()
    return s if s != "" else None

def _clean_keep_empty(v: Any) -> Optional[str]:
    # returns "" when blank (used for status fields if you want to keep blanks)
    if v is None: return ""
    s = str(v).strip()
    return s  # may be ""

_DATE_FORMATS = [
    "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y",
    "%d.%m.%Y", "%Y/%m/%d"
]
def _date(v: Any) -> Optional[date]:
    s = _clean(v)
    if not s: return None
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt).date()
        except:  # noqa: E722
            pass
    if re.fullmatch(r"\d{4}", s):
        return date(int(s), 1, 1)
    return None

def _dor_from_dob(dob: Optional[date]) -> Optional[date]:
    if not isinstance(dob, date): return None
    try:
        return date(dob.year + 60, dob.month, dob.day)
    except:  # noqa: E722
        return None

def _int(v: Any) -> Optional[int]:
    if v in (None, ""): return None
    try: return int(str(v).strip())
    except: return None

def _norm_pool(s: Any) -> Optional[str]:
    x = _clean(s)
    if not x: return None
    x = x.lower()
    if "estate" in x: return "Estate Office"
    if "cda" in x: return "CDA"
    return x

def _norm_medium(s: Any) -> Optional[str]:
    x = _clean(s)
    if not x: return None
    x = x.lower()
    if "family" in x: return "family transfer"
    if "mutual" in x: return "mutual"
    if "change" in x: return "changes"
    if "fresh" in x: return "fresh"
    if "transit" in x: return "Transit"
    return x

def _norm_qtr_status(s: Any, keep_empty: bool) -> Optional[str]:
    if s in (None, ""): return "" if keep_empty else None
    x = str(s).strip().lower()
    if x in ("active", "occupied"): return "active"
    if x in ("ended", "vacant"):    return "ended"
    return x

def _norm_allottee_status(s: Any, keep_empty: bool) -> Optional[str]:
    if s in (None, ""): return "" if keep_empty else None
    x = str(s).strip().lower()
    if x in ("in service","in_service","service"): return "in_service"
    if x in ("retired","retire"): return "retired"
    if x in ("cancelled","canceled"): return "cancelled"
    return x

# ----------------- DB helpers -----------------
def reflect(engine: Engine, name: str) -> Table:
    """Reflect table without following FKs (avoids missing 'house_old' explosions)."""
    meta = MetaData()
    try:
        return Table(name, meta, autoload_with=engine, resolve_fks=False)
    except TypeError:
        return Table(name, meta, autoload_with=engine)

def preload_house_maps(conn, house_table: Table):
    rows = conn.execute(select(
        house_table.c.id, house_table.c.file_no, house_table.c.qtr_no,
        house_table.c.sector, house_table.c.street
    )).fetchall()
    by_file_qtr, by_file, by_triplet, file_counts = {}, {}, {}, {}
    for r in rows:
        m = dict(r._mapping)
        hid = m["id"]
        file_no = (m.get("file_no") or "").strip()
        qtr_no  = (m.get("qtr_no") or "").strip()
        sector  = (m.get("sector") or "").strip()
        street  = (m.get("street") or "").strip()
        if file_no and qtr_no:
            by_file_qtr[(file_no, qtr_no)] = hid
        if file_no:
            file_counts[file_no] = file_counts.get(file_no, 0) + 1
            by_file.setdefault(file_no, hid)
        if sector and street and qtr_no:
            by_triplet[(sector, street, qtr_no)] = hid
    by_file_unique = {k:v for k,v in by_file.items() if file_counts.get(k) == 1}
    return by_file_qtr, by_file_unique, by_triplet

def resolve_house_id(row: Dict[str, Any], maps) -> Optional[int]:
    by_file_qtr, by_file_unique, by_triplet = maps
    file_no = row.get("file_no") or ""
    qtr_no  = row.get("qtr_no") or ""
    sector  = row.get("sector") or ""
    street  = row.get("street") or ""
    if file_no and qtr_no and (file_no, qtr_no) in by_file_qtr:
        return by_file_qtr[(file_no, qtr_no)]
    if file_no and file_no in by_file_unique:
        return by_file_unique[file_no]
    if sector and street and qtr_no and (sector, street, qtr_no) in by_triplet:
        return by_triplet[(sector, street, qtr_no)]
    return None

def upsert(conn, table: Table, data: Dict[str, Any], unique_by: Tuple[str,...]) -> str:
    conds = []
    for k in unique_by:
        v = data.get(k)
        if v in (None, ""):
            return "skip_nokey"
        conds.append(table.c[k] == v)
    hit = conn.execute(select(table.c.id).where(and_(*conds)).limit(1)).fetchone()
    payload = {k: data.get(k) for k in data.keys() if k in table.c}
    if hit:
        conn.execute(update(table).where(table.c.id == hit[0]).values(**payload))
        return "update"
    else:
        conn.execute(insert(table).values(**payload))
        return "insert"

# ----------------- main -----------------
def main():
    ap = argparse.ArgumentParser(description="Import allotments (headerless/headered; safe; blanks kept).")
    ap.add_argument("--csv", required=True)
    ap.add_argument("--db", default=None)
    ap.add_argument("--table", default="allotment")
    ap.add_argument("--houses-table", default="house")
    ap.add_argument("--unique", nargs="+", default=["house_id","occupation_date","person_name"])
    ap.add_argument("--batch", type=int, default=1000)
    ap.add_argument("--dry", action="store_true")
    # CSV modes
    ap.add_argument("--no-header", action="store_true", default=False,
                    help="CSV has no header row; use --order to map columns")
    ap.add_argument("--order", default="",
                    help=("Order when --no-header is used. Example: "
                          "file_no,qtr_no,person_name,designation,directorate,cnic,pool,medium,bps,"
                          "allotment_date,occupation_date,vacation_date,dob,dor,retention_last,"
                          "qtr_status,allottee_status,notes,sector,street"))
    # behaviors
    ap.add_argument("--keep-empty-statuses", action="store_true", default=True,
                    help="Keep '' for qtr_status/allottee_status instead of NULL (default: True)")
    ap.add_argument("--auto-dor", action="store_true", help="Compute DOR = DOB + 60y when missing")
    ap.add_argument("--fk-off", action="store_true", default=True, help="Disable SQLite FK checks during import (default: on)")
    ap.add_argument("--peek", type=int, default=0, help="Print first N parsed rows then exit")
    args = ap.parse_args()

    db_url = args.db or os.getenv("DATABASE_URL") or os.getenv("SQLALCHEMY_DATABASE_URI") or "sqlite:///./accommodation.db"
    engine = create_engine(db_url, future=True)

    # optionally disable FKs during import (helps if legacy FK points to house_old)
    if args.fk_off:
        with engine.begin() as c:
            try: c.execute(text("PRAGMA foreign_keys=OFF;"))
            except: pass

    allot_tbl = reflect(engine, args.table)
    house_tbl = reflect(engine, args.houses_table)

    # Determine DB column types so we pass correct Python types
    DATE_COLS = {c.name for c in allot_tbl.c if isinstance(c.type, (SA_Date, DateTime))}
    TEXT_COLS = {c.name for c in allot_tbl.c if isinstance(c.type, SA_String)}

    def adapt_dates_for_sqlalchemy(payload: Dict[str, Any]):
        for k in ("allotment_date","occupation_date","vacation_date","dob","dor","retention_last"):
            v = payload.get(k)
            if v is None:
                continue
            if k in DATE_COLS:
                if isinstance(v, str):
                    # parse string to date if possible
                    try:
                        payload[k] = datetime.strptime(v, "%Y-%m-%d").date()
                    except:  # noqa: E722
                        dv = _date(v)
                        payload[k] = dv if dv else None
            elif k in TEXT_COLS:
                if isinstance(v, date):
                    payload[k] = v.isoformat()

    inserts=updates=skip_nokey=skip_nohouse=skip_allblank=0
    batch_rows: List[Dict[str, Any]] = []

    # preload house mappings once
    with engine.connect() as conn:
        maps = preload_house_maps(conn, house_tbl)

    def build_row(vals: Dict[str, Any]) -> Dict[str, Any]:
        file_no = _clean(vals.get("file_no"))
        qtr_no  = _clean(vals.get("qtr_no"))
        sector  = _clean(vals.get("sector"))
        street  = _clean(vals.get("street"))

        person_name = _clean(vals.get("person_name"))
        designation = _clean(vals.get("designation"))
        directorate = _clean(vals.get("directorate"))
        cnic        = _clean(vals.get("cnic"))
        pool        = _norm_pool(vals.get("pool"))
        medium      = _norm_medium(vals.get("medium"))
        bps         = _int(vals.get("bps"))

        allotment_date  = _date(vals.get("allotment_date"))
        occupation_date = _date(vals.get("occupation_date"))
        vacation_date   = _date(vals.get("vacation_date"))
        dob             = _date(vals.get("dob"))
        dor             = _date(vals.get("dor"))
        if not dor and args.auto_dor:
            dor = _dor_from_dob(dob)
        retention_last  = _date(vals.get("retention_last"))

        qtr_status      = _norm_qtr_status(vals.get("qtr_status"), keep_empty=args.keep_empty_statuses)
        allottee_status = _norm_allottee_status(vals.get("allottee_status"), keep_empty=args.keep_empty_statuses)
        notes           = _clean(vals.get("notes"))

        hid = resolve_house_id(
            {"file_no": file_no, "qtr_no": qtr_no, "sector": sector, "street": street},
            maps
        )
        if not hid:
            return {"__skip__": "no_house"}

        data: Dict[str, Any] = {
            "house_id": hid,
            "person_name": person_name,
            "designation": designation,
            "directorate": directorate,
            "cnic": cnic,
            "pool": pool,
            "medium": medium,
            "bps": bps,
            "allotment_date": allotment_date,
            "occupation_date": occupation_date,
            "vacation_date": vacation_date,
            "dob": dob,
            "dor": dor,
            "retention_last": retention_last,
            "qtr_status": qtr_status if qtr_status is not None else None,
            "allottee_status": allottee_status if allottee_status is not None else None,
            "notes": notes,
        }

        # restrict to real columns; keep empty "" for status fields if requested
        data = {k: v for k, v in data.items()
                if k in allot_tbl.c and (v is not None or k in ("qtr_status","allottee_status"))}

        adapt_dates_for_sqlalchemy(data)
        return data

    def flush_batch():
        nonlocal inserts, updates
        if not batch_rows: return
        with engine.begin() as conn:
            for row in batch_rows:
                res = upsert(conn, allot_tbl, row, tuple(args.unique))
                if res == "insert": inserts += 1
                elif res == "update": updates += 1
        batch_rows.clear()

    with open(args.csv, newline='', encoding='utf-8-sig') as f:
        rdr = csv.reader(f)

        if args.no_header:
            if not args.order:
                raise SystemExit("When using --no-header you must pass --order (comma list)")
            order = [x.strip() for x in args.order.split(",") if x.strip()]
            shown = 0
            for raw in rdr:
                vals = {order[i]: (raw[i] if i < len(raw) else None) for i in range(len(order))}
                row = build_row(vals)
                if "__skip__" in row:
                    skip_nohouse += 1; continue
                if not any(v not in (None, "") for v in vals.values()):
                    skip_allblank += 1; continue
                if not all(row.get(k) for k in args.unique):
                    skip_nokey += 1; continue
                if args.peek and shown < args.peek:
                    print("[PEEK]", row); shown += 1
                    if shown >= args.peek:
                        print("[INFO] Peek complete."); return
                batch_rows.append(row)
                if len(batch_rows) >= args.batch and not args.dry:
                    flush_batch()

        else:
            header = next(rdr, [])
            idx = {h:i for i,h in enumerate(header)}
            shown = 0
            for raw in rdr:
                vals = {h: (raw[i] if i < len(raw) else None) for h,i in idx.items()}
                row = build_row(vals)
                if "__skip__" in row:
                    skip_nohouse += 1; continue
                if not any(v not in (None, "") for v in vals.values()):
                    skip_allblank += 1; continue
                if not all(row.get(k) for k in args.unique):
                    skip_nokey += 1; continue
                if args.peek and shown < args.peek:
                    print("[PEEK]", row); shown += 1
                    if shown >= args.peek:
                        print("[INFO] Peek complete."); return
                batch_rows.append(row)
                if len(batch_rows) >= args.batch and not args.dry:
                    flush_batch()

    if batch_rows and not args.dry:
        flush_batch()

    print(f"[RESULT] inserts={inserts}, updates={updates}, skipped_no_key={skip_nokey}, "
          f"skipped_no_house={skip_nohouse}, skipped_all_blank={skip_allblank}")

if __name__ == "__main__":
    main()
