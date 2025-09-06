#!/usr/bin/env python3
import argparse, csv, os, re, time, datetime as dt
from typing import Any, Dict, Optional, Tuple, List

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

from sqlalchemy import create_engine, MetaData, Table, select, update, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError

STATUS_MAP = {
    "available":"available","vacant":"vacant","occupied":"occupied","reserved":"reserved",
    "maintenance":"maintenance","other":"other","issue_in_record":"issue_in_record","missing":"missing",
    "issue in record":"issue_in_record","issue-in-record":"issue_in_record","issues in record":"issue_in_record",
    "ended":"vacant","active":"occupied","null":None,"none":None,"":""
}
TYPE_ALLOWED = set("ABCDEFGH")

def env_url(cli: Optional[str]) -> str:
    return cli or os.getenv("DATABASE_URL") or os.getenv("SQLALCHEMY_DATABASE_URI") or "sqlite:///./app.db"

def norm_str(v: Any) -> Optional[str]:
    if v is None: return None
    s = str(v).strip()
    return s if s else None

def norm_sector(v: Any) -> Optional[str]:
    s = norm_str(v)
    if s is None: return None
    s = s.upper()
    return "SITE" if s.lower()=="site" else s

def norm_qtr_no(v: Any) -> Optional[str]:
    s = norm_str(v)
    if s is None: return None
    s = re.sub(r"\s*-\s*", "-", s)
    s = re.sub(r"\s+", " ", s)
    return s

def norm_type_code(v: Any) -> Optional[str]:
    s = norm_str(v)
    if s is None: return None
    s = re.sub(r"[^A-Za-z]", "", s.upper())
    return s[0] if s and s[0] in TYPE_ALLOWED else None

def norm_status(v: Any) -> Optional[str]:
    s = norm_str(v)
    if s is None: return None
    key = re.sub(r"\s+", " ", s.lower().replace("-", " ").strip())
    return STATUS_MAP.get(key, key)

def blanks_to_none(d: Dict[str, Any]) -> Dict[str, Any]:
    out = {}
    for k, v in d.items():
        out[k] = None if (isinstance(v, str) and v.strip()=="") else v
    return out

def reflect_table(engine: Engine, name: str) -> Table:
    meta = MetaData()
    meta.reflect(bind=engine, only=[name])
    if name not in meta.tables:
        raise RuntimeError(f"Table '{name}' not found.")
    return meta.tables[name]

def backup_table(engine: Engine, table_name: str) -> str:
    ts = dt.datetime.now().strftime("%Y%m%d%H%M%S")
    backup = f"{table_name}_backup_{ts}"
    with engine.begin() as conn:
        conn.execute(text(f'CREATE TABLE "{backup}" AS SELECT * FROM "{table_name}"'))
    return backup

def main():
    ap = argparse.ArgumentParser(description="Clean/normalize 'houses' table safely")
    ap.add_argument("--db", default=None, help="DB URL (e.g., sqlite:////abs/path/app.db)")
    ap.add_argument("--table", default="houses")
    ap.add_argument("--batch", type=int, default=500)
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--no-backup", action="store_true")
    args = ap.parse_args()

    engine = create_engine(env_url(args.db), future=True)
    table = reflect_table(engine, args.table)

    if not args.no-backup and not args.dry:
        try:
            name = backup_table(engine, args.table)
            print(f"[OK] backup created: {name}")
        except SQLAlchemyError as e:
            print(f"[WARN] backup failed: {e}")

    need = ["file_no","qtr_no","sector","street","type_code","status"]
    have = {c: (c in table.c) for c in need}

    select_cols = [table.c.id] + [getattr(table.c, c) for c in need if have[c]]
    with engine.connect() as conn:
        rows = conn.execute(select(*select_cols)).fetchall()

    def cleaned(rd: Dict[str, Any]) -> Dict[str, Any]:
        d: Dict[str, Any] = {}
        if have["file_no"]:   d["file_no"]   = norm_str(rd.get("file_no"))
        if have["qtr_no"]:    d["qtr_no"]    = norm_qtr_no(rd.get("qtr_no"))
        if have["sector"]:    d["sector"]    = norm_sector(rd.get("sector"))
        if have["street"]:    d["street"]    = norm_str(rd.get("street"))
        if have["type_code"]: d["type_code"] = norm_type_code(rd.get("type_code"))
        if have["status"]:    d["status"]    = norm_status(rd.get("status"))
        return blanks_to_none(d)

    total=0; updated=0; errs=[]
    batch = []
    for r in rows:
        total += 1
        rd = dict(r._mapping)
        rid = rd["id"]
        want = cleaned(rd)
        diff = {}
        for k,v in want.items():
            if k not in rd: continue
            old = rd[k]
            old = None if (old is None or (isinstance(old,str) and old.strip()=="")) else old
            if old != v:
                diff[k]=v
        if diff:
            batch.append((rid,diff))
        if len(batch) >= args.batch:
            try:
                if not args.dry:
                    with engine.begin() as conn:
                        for rid2,diff2 in batch:
                            conn.execute(update(table).where(table.c.id==rid2).values(**diff2))
                updated += len(batch)
            except SQLAlchemyError as e:
                errs.append(("batch", str(e)))
            finally:
                batch.clear()

    if batch:
        try:
            if not args.dry:
                with engine.begin() as conn:
                    for rid2,diff2 in batch:
                        conn.execute(update(table).where(table.c.id==rid2).values(**diff2))
            updated += len(batch)
        except SQLAlchemyError as e:
            errs.append(("final", str(e)))

    if errs:
        with open("clean_errors.csv","w",newline="",encoding="utf-8") as f:
            w=csv.writer(f); w.writerow(["where","error"]); w.writerows(errs)
        print(f"[DONE] rows scanned: {total}, updated: {updated}, errors: {len(errs)} (see clean_errors.csv)")
    else:
        print(f"[DONE] rows scanned: {total}, updated: {updated}, errors: 0")

if __name__=="__main__":
    main()
