#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Allotment CSV importer (full fields)
- Reads DB URL from: --db > DATABASE_URL > SQLALCHEMY_DATABASE_URL > SQLALCHEMY_DATABASE_URI
- Windows-safe sqlite URL normalization (drive letters / UNC)
- Creates missing users with a placeholder bcrypt-like hash and is_active=0 (no hashing cost)
- Upsert key: (house_id, user_id, allotment_date) or (house_id, person_name, allotment_date) if CNIC missing
- Maps exactly your CSV header:
  file_no,qtr_no,person_name,designation,directorate,cnic,pool,medium,bps,
  allotment_date,occupation_date,vacation_date,dob,dor,retention_last,
  qtr_status,allottee_status,notes
"""
import csv, os, re, sys
from datetime import datetime
from pathlib import Path
from typing import Optional, Iterable

# ----- ENV -----
def load_env():
    try:
        from dotenv import load_dotenv
    except Exception:
        return
    here = Path(__file__).resolve().parent
    for p in (here / ".env", here.parent / ".env"):
        if p.exists():
            load_dotenv(p, override=False)
    load_dotenv(override=False)

# ----- sqlite URL helpers -----
def normalize_sqlite_url(url: str) -> str:
    if not url.startswith("sqlite:"):
        raise SystemExit(f"[FATAL] Only sqlite URLs supported here, got: {url!r}")
    url = url.replace("\\", "/")
    if url in ("sqlite://", "sqlite:///:memory:", "sqlite:///:memory"):
        return "sqlite:///:memory:"
    m = re.match(r"^sqlite:(//+)(.*)$", url)
    if not m:
        rest = url.split(":", 1)[1].lstrip("/")
        return build_sqlite_url_from_path(rest)
    _, rest = m.groups()
    if rest.startswith("//"):  # UNC
        return f"sqlite:////{rest.lstrip('/')}"
    if re.match(r"^[A-Za-z]:/", rest):  # drive
        return f"sqlite:///{rest}"
    if rest.startswith("/"):  # POSIX abs
        return f"sqlite:////{rest}"
    return build_sqlite_url_from_path(rest)

def build_sqlite_url_from_path(p: str) -> str:
    base = Path(__file__).resolve().parent.parent  # .../backend
    abs_posix = (base / p).resolve().as_posix()
    return f"sqlite:///{abs_posix}" if re.match(r"^[A-Za-z]:/", abs_posix) else f"sqlite:////{abs_posix}"

def sqlite_path_from_url(url: str) -> str:
    rest = url.split(":", 1)[1].lstrip("/")
    if rest.startswith("//"): return f"//{rest}"
    if re.match(r"^[A-Za-z]:/", rest): return rest
    if rest.startswith(":memory:"): return ":memory:"
    return "/" + rest

# ----- CSV helpers -----
def open_csv_with_fallback(path: Path, encodings: Iterable[str] = ("utf-8-sig","cp1252")):
    last_err = None
    for enc in encodings:
        try:
            return open(path, newline="", encoding=enc), enc
        except UnicodeDecodeError as e:
            last_err = e
    raise last_err or FileNotFoundError(path)

def norm(s: Optional[str]) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())

def to_int(s: Optional[str]) -> Optional[int]:
    s = norm(s)
    if not s: return None
    try: return int(s)
    except Exception: return None

def parse_date(s: Optional[str]) -> Optional[str]:
    s = (s or "").strip()
    if not s: return None
    for fmt in ("%Y-%m-%d","%d-%m-%Y","%d/%m/%Y","%m/%d/%Y","%d-%b-%Y","%d.%m.%Y"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            pass
    m = re.match(r"^(\d{1,2})[-/](\d{1,2})[-/](\d{2})$", s)
    if m:
        d, m_, y = map(int, m.groups())
        y += 2000 if y < 70 else 1900
        try: return datetime(y, m_, d).date().isoformat()
        except ValueError: return None
    return None

ALLOWED_POOLS = {"CDA": "CDA", "ESTATE OFFICE": "Estate Office"}
HASHED_PASSWORD_PLACEHOLDER = "$2b$12$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"  # 60 chars

# ----- DB helpers (sqlite3) -----
def table_exists(cur, name: str) -> bool:
    return cur.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)).fetchone() is not None

def get_cols(cur, table: str) -> set[str]:
    return {r[1] for r in cur.execute(f"PRAGMA table_info('{table}')").fetchall()}

def get_house_id(cur, file_no: str) -> Optional[int]:
    row = cur.execute("SELECT id FROM house WHERE file_no = ?", (file_no,)).fetchone()
    return row[0] if row else None

def get_or_create_user(cur, user_cols: set[str], cnic: Optional[str], person_name: Optional[str]) -> Optional[int]:
    username = norm(cnic) if norm(cnic) else (norm(person_name).lower().replace(" ", "_") if person_name else None)
    if not username: return None
    row = cur.execute("SELECT id FROM user WHERE username = ?", (username,)).fetchone()
    if row: return row[0]
    cols, vals = [], []
    def add(c, v):
        if c in user_cols: cols.append(c); vals.append(v)
    add("username", username)
    add("full_name", person_name or None)
    add("hashed_password", HASHED_PASSWORD_PLACEHOLDER)
    add("is_active", 0)
    add("role", "viewer")
    add("permissions", None)
    add("password", None)        # legacy if exists
    add("is_superuser", 0)
    cur.execute(f"INSERT INTO user ({', '.join(cols)}) VALUES ({', '.join('?' for _ in vals)})", vals)
    return cur.lastrowid

# ----- MAIN -----
def main() -> int:
    import argparse, sqlite3
    load_env()

    ap = argparse.ArgumentParser(description="Allotment CSV importer (full fields)")
    ap.add_argument("--db", default=None, help="sqlite URL (e.g. sqlite:///C:/path/accommodation.db)")
    ap.add_argument("--csv", default=None, help="CSV path (env ALLOTMENT_CSV or allotment-data.csv)")
    ap.add_argument("--commit-every", type=int, default=1000)
    ap.add_argument("--verbose", action="store_true")
    ap.add_argument("--dry", action="store_true")
    args = ap.parse_args()

    db_url = args.db or os.getenv("DATABASE_URL") or os.getenv("SQLALCHEMY_DATABASE_URL") or os.getenv("SQLALCHEMY_DATABASE_URI")
    if not db_url: 
        print("[FATAL] No DB URL"); return 2
    db_url = normalize_sqlite_url(db_url)
    db_path = sqlite_path_from_url(db_url)

    if db_path != ":memory:":
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys=ON;")
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.execute("PRAGMA busy_timeout=5000;")
    cur = conn.cursor()

    for t in ("house", "user", "allotment"):
        if not table_exists(cur, t):
            print(f"[FATAL] missing table: {t}"); return 2

    allot_cols = get_cols(cur, "allotment")
    user_cols   = get_cols(cur, "user")

    csv_env = args.csv or os.getenv("ALLOTMENT_CSV") or "allotment-data.csv"
    csv_path = Path(csv_env)
    if not csv_path.is_absolute():
        if not csv_path.exists(): csv_path = Path.cwd() / csv_env
        if not csv_path.exists(): csv_path = Path(__file__).resolve().parent / csv_env
    if not csv_path.exists(): 
        print(f"[FATAL] CSV not found: {csv_env}"); return 2

    f, enc = open_csv_with_fallback(csv_path)
    print(f"[INFO] DB:  {db_url}")
    print(f"[INFO] CSV: {csv_path}  (encoding={enc})")

    inserted = updated = skipped = processed = 0

    with f:
        rdr = csv.DictReader(f)
        need = ["file_no","person_name","cnic","allotment_date"]
        for c in need:
            if c not in (rdr.fieldnames or []):
                print(f"[WARN] column {c!r} not found in CSV")

        for row in rdr:
            processed += 1
            file_no = norm(row.get("file_no"))
            if not file_no:
                skipped += 1; continue

            # resolve house
            house_id = get_house_id(cur, file_no)
            if not house_id:
                skipped += 1; continue

            # user
            person_name = norm(row.get("person_name")) or None
            cnic = norm(row.get("cnic")) or None
            user_id = get_or_create_user(cur, user_cols, cnic, person_name)
            if not user_id:
                skipped += 1; continue

            # coerce values
            pool = norm(row.get("pool"))
            if pool:
                key = pool.replace("-", " ").replace(".", "").upper()
                pool = ALLOWED_POOLS.get(key, pool)

            payload = {
                "house_id": house_id,
                "user_id":  user_id,
                "person_name": person_name,
                "designation": norm(row.get("designation")) or None,
                "directorate": norm(row.get("directorate")) or None,
                "cnic": cnic,
                "pool": pool or None,
                "medium": norm(row.get("medium")) or None,
                "bps": to_int(row.get("bps")),
                "allotment_date": parse_date(row.get("allotment_date")),
                "occupation_date": parse_date(row.get("occupation_date")),
                "vacation_date": parse_date(row.get("vacation_date")),
                "dob": parse_date(row.get("dob")),
                "dor": parse_date(row.get("dor")),
                "retention_last": parse_date(row.get("retention_last")),
                # retention_until not in CSV -> leave None
                "qtr_status": norm(row.get("qtr_status")) or None,
                "allottee_status": norm(row.get("allottee_status")) or None,
                "notes": norm(row.get("notes")) or None,
            }

            # keep only existing columns (so it works with your actual table)
            payload = {k: v for k, v in payload.items() if k in allot_cols}

            # upsert key: (house_id, user_id, allotment_date) or (house_id, person_name, allotment_date)
            k_date = payload.get("allotment_date")
            if cnic:   # has user identity
                hit = cur.execute(
                    "SELECT id FROM allotment WHERE house_id=? AND user_id=? AND IFNULL(allotment_date,'')=IFNULL(?, '')",
                    (house_id, user_id, k_date)
                ).fetchone()
            else:      # fall back to person_name
                hit = cur.execute(
                    "SELECT id FROM allotment WHERE house_id=? AND person_name=? AND IFNULL(allotment_date,'')=IFNULL(?, '')",
                    (house_id, person_name, k_date)
                ).fetchone()

            if hit:
                sets = ", ".join([f"{k}=?" for k in payload.keys()])
                cur.execute(f"UPDATE allotment SET {sets} WHERE id=?", [*payload.values(), hit[0]])
                updated += 1
            else:
                cols = ", ".join(payload.keys())
                qs   = ", ".join("?" for _ in payload)
                cur.execute(f"INSERT INTO allotment ({cols}) VALUES ({qs})", list(payload.values()))
                inserted += 1

            if not args.dry and processed % args.commit_every == 0:
                conn.commit()
                if args.verbose:
                    print(f"[PROGRESS] rows={processed} inserted={inserted} updated={updated} skipped={skipped}")

    if not args.dry: conn.commit()
    print(f"[RESULT] rows={processed} inserted={inserted} updated={updated} skipped={skipped}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
