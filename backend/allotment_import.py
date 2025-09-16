#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Allotment CSV importer (no password hashing)
- Creates users with a constant placeholder bcrypt-looking hash
- Sets users is_active=0 by default (cannot log in)
- Reads DB URL from: --db > DATABASE_URL > SQLALCHEMY_DATABASE_URL > SQLALCHEMY_DATABASE_URI
- Windows-safe sqlite URL handling (drive letters / UNC)
- Chunked commits with progress
"""

import csv
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional, Iterable

# ---------- env ----------
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

# ---------- sqlite URL helpers ----------
def normalize_sqlite_url(url: str) -> str:
    if not url.startswith("sqlite:"):
        raise SystemExit(f"[FATAL] Only sqlite URLs are supported by this script. Got: {url!r}")
    url = url.replace("\\", "/")
    if url in ("sqlite://", "sqlite:///:memory:", "sqlite:///:memory"):
        return "sqlite:///:memory:"
    m = re.match(r"^sqlite:(//+)(.*)$", url)
    if not m:
        rest = url.split(":", 1)[1].lstrip("/")
        return build_sqlite_url_from_path(rest)
    _, rest = m.groups()
    if rest.startswith("//"):                     # UNC
        rest = rest.lstrip("/")
        return f"sqlite:////{rest}"
    if re.match(r"^[A-Za-z]:/", rest):            # Windows drive
        return f"sqlite:///{rest}"
    if rest.startswith("/"):                      # POSIX absolute
        return f"sqlite:////{rest}"
    return build_sqlite_url_from_path(rest)

def build_sqlite_url_from_path(p: str) -> str:
    base = Path(__file__).resolve().parent.parent  # .../backend
    abs_path = (base / p).resolve().as_posix()
    if re.match(r"^[A-Za-z]:/", abs_path):         # Windows drive
        return f"sqlite:///{abs_path}"
    return f"sqlite:////{abs_path}"

def sqlite_path_from_url(url: str) -> str:
    rest = url.split(":", 1)[1].lstrip("/")
    if re.match(r"^[A-Za-z]:/", rest):            # drive
        return rest
    if rest.startswith("//"):                     # UNC
        return f"//{rest}"
    if rest.startswith(":memory:"):
        return ":memory:"
    return "/" + rest

# ---------- CSV / date ----------
DATE_FROM_COL = "allotment_date"
DATE_TO_COL   = "vacation_date"
FILE_NO_COL   = "file_no"
CNIC_COL      = "cnic"
NAME_COL      = "person_name"

def parse_date(s: str) -> Optional[str]:
    if not s: return None
    s = s.strip()
    if not s: return None
    for fmt in ("%Y-%m-%d","%d-%m-%Y","%d/%m/%Y","%m/%d/%Y","%d-%b-%Y","%d.%m.%Y"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            pass
    m = re.match(r"^(\d{1,2})[-/](\d{1,2})[-/](\d{2})$", s)
    if m:
        d, mn, yy = map(int, m.groups())
        yyyy = 2000 + yy if yy < 70 else 1900 + yy
        try:
            return datetime(yyyy, mn, d).date().isoformat()
        except ValueError:
            return None
    return None

def norm(s: Optional[str]) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())

def open_csv_with_fallback(path: Path, encodings: Iterable[str] = ("utf-8-sig","cp1252")):
    last_err = None
    for enc in encodings:
        try:
            return open(path, newline="", encoding=enc), enc
        except UnicodeDecodeError as e:
            last_err = e
    raise last_err or FileNotFoundError(path)

# ---------- DB helpers ----------
# syntactically valid bcrypt string; verification will fail, but no hashing cost
HASHED_PASSWORD_PLACEHOLDER = "$2b$12$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"  # 60 chars

def table_exists(cur, name: str) -> bool:
    return cur.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
        (name,)
    ).fetchone() is not None

def get_columns(cur, table: str) -> set[str]:
    return {r[1] for r in cur.execute(f"PRAGMA table_info('{table}')").fetchall()}

def get_house_id(cur, file_no: str) -> Optional[int]:
    row = cur.execute("SELECT id FROM house WHERE file_no = ?", (file_no,)).fetchone()
    return row[0] if row else None

def get_or_create_user(cur, user_cols: set[str], cnic: Optional[str], name: Optional[str]) -> Optional[int]:
    username = None
    if cnic:
        username = norm(cnic)
    elif name:
        username = norm(name).lower().replace(" ", "_")
    if not username:
        return None

    row = cur.execute("SELECT id FROM user WHERE username = ?", (username,)).fetchone()
    if row:
        return row[0]

    cols, vals = [], []
    def add(col, val):
        if col in user_cols:
            cols.append(col); vals.append(val)

    add("username", username)
    add("full_name", name or None)
    add("hashed_password", HASHED_PASSWORD_PLACEHOLDER)  # NOT NULL in new schema, no hashing
    add("is_active", 0)                                  # keep disabled by default
    add("role", "viewer")
    add("permissions", None)
    # legacy columns (harmless if present)
    add("password", None)
    add("is_superuser", 0)

    cur.execute(f"INSERT INTO user ({', '.join(cols)}) VALUES ({', '.join('?' for _ in vals)})", vals)
    return cur.lastrowid

# ---------- Main ----------
def main() -> int:
    import argparse, sqlite3

    load_env()

    ap = argparse.ArgumentParser(description="Allotment CSV importer (no password hashing)")
    ap.add_argument("--db", default=None, help="Override DB URL (e.g. sqlite:///C:/path/accommodation.db)")
    ap.add_argument("--csv", default=None, help="CSV path (env ALLOTMENT_CSV or allotment-data.csv)")
    ap.add_argument("--commit-every", type=int, default=1000, help="Commit after N rows")
    ap.add_argument("--verbose", action="store_true", help="Print progress every commit chunk")
    ap.add_argument("--dry", action="store_true", help="Parse only; no DB writes")
    args = ap.parse_args()

    db_url = args.db \
        or os.getenv("DATABASE_URL") \
        or os.getenv("SQLALCHEMY_DATABASE_URL") \
        or os.getenv("SQLALCHEMY_DATABASE_URI")
    if not db_url:
        print("[FATAL] No DB URL. Set DATABASE_URL or pass --db")
        return 2

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
            print(f"[FATAL] table '{t}' not found in DB.")
            return 2

    user_cols = get_columns(cur, "user")

    csv_env = args.csv or os.getenv("ALLOTMENT_CSV") or "allotment-data.csv"
    csv_path = Path(csv_env)
    if not csv_path.is_absolute():
        if not csv_path.exists(): csv_path = (Path.cwd() / csv_env)
        if not csv_path.exists(): csv_path = (Path(__file__).resolve().parent / csv_env)
    if not csv_path.exists():
        print(f"[FATAL] CSV not found: {csv_env}")
        return 2

    f, used_enc = open_csv_with_fallback(csv_path)
    print(f"[INFO] DB:  {db_url}")
    print(f"[INFO] CSV: {csv_path}  (encoding={used_enc})")

    inserts = updates = skip_no_house = skip_no_key = processed = 0

    with f:
        rdr = csv.DictReader(f)
        for col in (FILE_NO_COL, CNIC_COL, NAME_COL, DATE_FROM_COL, DATE_TO_COL):
            if col not in (rdr.fieldnames or []):
                print(f"[WARN] column '{col}' not in CSV; continuing")

        for r in rdr:
            processed += 1
            file_no = norm(r.get(FILE_NO_COL, ""))
            if not file_no:
                skip_no_key += 1
                continue

            cnic = norm(r.get(CNIC_COL, ""))
            name = norm(r.get(NAME_COL, "")) or None
            user_id = get_or_create_user(cur, user_cols, cnic or None, name)
            if not user_id:
                skip_no_key += 1
                continue

            house_id = get_house_id(cur, file_no)
            if not house_id:
                skip_no_house += 1
                continue

            date_from = parse_date(r.get(DATE_FROM_COL, "") or "")
            date_to   = parse_date(r.get(DATE_TO_COL, "") or "")

            if not args.dry:
                hit = cur.execute(
                    """SELECT id FROM allotment
                       WHERE house_id=? AND user_id=? AND IFNULL(date_from,'')=IFNULL(?, '')""",
                    (house_id, user_id, date_from)
                ).fetchone()

                if hit:
                    cur.execute("UPDATE allotment SET date_to=? WHERE id=?", (date_to, hit[0]))
                    updates += 1
                else:
                    cur.execute(
                        "INSERT INTO allotment (house_id, user_id, date_from, date_to) VALUES (?,?,?,?)",
                        (house_id, user_id, date_from, date_to)
                    )
                    inserts += 1

            if not args.dry and (processed % args.commit_every == 0):
                conn.commit()
                if args.verbose:
                    print(f"[PROGRESS] rows={processed} inserts={inserts} updates={updates} "
                          f"skip_no_key={skip_no_key} skip_no_house={skip_no_house}")

    if not args.dry:
        conn.commit()

    print(f"[RESULT] rows={processed} inserts={inserts} updates={updates} "
          f"skip_no_key={skip_no_key} skip_no_house={skip_no_house}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
