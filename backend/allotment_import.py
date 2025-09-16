#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Allotment CSV importer (Windows-friendly, .env-driven)

- Reads DB URL from: --db > DATABASE_URL > SQLALCHEMY_DATABASE_URL > SQLALCHEMY_DATABASE_URI
- Supports sqlite URLs on Windows (drive letters / UNC) and POSIX
- Creates missing users using new schema (hashed_password, is_active, role)
- Upserts allotments keyed by (house_id, user_id, date_from)
"""

import csv
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional, Iterable

# -----------------------
# .env loading (optional)
# -----------------------
def load_env_files():
    try:
        from dotenv import load_dotenv
    except Exception:
        return
    here = Path(__file__).resolve().parent
    for candidate in (here / ".env", here.parent / ".env"):
        if candidate.exists():
            load_dotenv(candidate, override=False)
    # final pass (walks up parents if not found above)
    load_dotenv(override=False)

# -----------------------
# URL / path helpers
# -----------------------
def normalize_sqlite_url(url: str) -> str:
    """
    Normalize sqlite URLs across Windows / POSIX.

    Windows drive path   -> sqlite:///C:/path/db.sqlite   (3 slashes)
    Windows UNC path     -> sqlite:////server/share/db.sqlite (4 slashes)
    POSIX absolute path  -> sqlite:////abs/path/db.sqlite (4 slashes)
    Relative path        -> sqlite:///relative.db         (3 slashes)
    In-memory            -> sqlite:///:memory:
    """
    if not url.startswith("sqlite:"):
        raise SystemExit(f"[FATAL] Only sqlite URLs are supported by this script. Got: {url!r}")

    url = url.replace("\\", "/")
    if url in ("sqlite://", "sqlite:///:memory:", "sqlite:///:memory"):
        return "sqlite:///:memory:"

    m = re.match(r"^sqlite:(//+)(.*)$", url)
    if not m:
        # e.g. "sqlite:relative.db" (missing slashes) → treat as relative
        rest = url.split(":", 1)[1].lstrip("/")
        return build_sqlite_url_from_path(rest)

    _, rest = m.groups()  # after the slashes
    if rest.startswith("//"):                 # UNC
        rest = rest.lstrip("/")
        return f"sqlite:////{rest}"
    if re.match(r"^[A-Za-z]:/", rest):        # Windows drive
        return f"sqlite:///{rest}"
    if rest.startswith("/"):                  # POSIX absolute
        return f"sqlite:////{rest}"
    # relative path
    return build_sqlite_url_from_path(rest)

def build_sqlite_url_from_path(p: str) -> str:
    base = Path(__file__).resolve().parent.parent  # repo/backend
    abs_path = (base / p).resolve()
    posix = abs_path.as_posix()
    if re.match(r"^[A-Za-z]:/", posix):           # Windows drive
        return f"sqlite:///{posix}"
    return f"sqlite:////{posix}"

def sqlite_path_from_url(url: str) -> str:
    """Extract filesystem path from normalized sqlite URL."""
    assert url.startswith("sqlite:")
    rest = url.split(":", 1)[1]
    rest = rest.lstrip("/")
    # UNC: four slashes → path starts with server/share
    # Drive letter path: starts like C:/...
    if re.match(r"^[A-Za-z]:/", rest):
        return rest
    # UNC (server/share/...)
    if re.match(r"^[^/]+/[^/]+/", rest):
        return f"//{rest}"
    # memory
    if rest.startswith(":memory:"):
        return ":memory:"
    return "/" + rest  # POSIX absolute

# -----------------------
# CSV / date helpers
# -----------------------
DATE_FROM_COL = "allotment_date"
DATE_TO_COL   = "vacation_date"
FILE_NO_COL   = "file_no"
CNIC_COL      = "cnic"
NAME_COL      = "person_name"

def parse_date(s: str) -> Optional[str]:
    if not s:
        return None
    s = s.strip()
    if not s:
        return None
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

# -----------------------
# DB helpers (sqlite3)
# -----------------------
DEFAULT_PASSWORD = "changeme"

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

def _hasher():
    # prefer passlib; fallback to bcrypt; final fallback to dummy bcrypt-like
    try:
        from passlib.context import CryptContext
        ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
        return lambda p: ctx.hash(p)
    except Exception:
        try:
            import bcrypt as _bcrypt
            return lambda p: _bcrypt.hashpw(p.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")
        except Exception:
            return lambda p: "$2b$12$" + ("x" * 53)  # 60-ish chars

hash_password = _hasher()

def get_or_create_user(cur, user_cols: set[str], cnic: Optional[str], name: Optional[str]) -> Optional[int]:
    # username by CNIC or sanitized name
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
    add("hashed_password", hash_password(DEFAULT_PASSWORD))  # NOT NULL in new schema
    add("is_active", 1)
    add("role", "viewer")
    add("permissions", None)
    # legacy compatibility (harmless if present)
    add("password", None)
    add("is_superuser", 0)

    cur.execute(f"INSERT INTO user ({', '.join(cols)}) VALUES ({', '.join('?' for _ in vals)})", vals)
    return cur.lastrowid

# -----------------------
# Main
# -----------------------
def main() -> int:
    import argparse
    load_env_files()

    ap = argparse.ArgumentParser(description="Allotment CSV importer (.env-driven, Windows-friendly)")
    ap.add_argument("--db", default=None, help="Override DB URL (e.g. sqlite:///C:/path/accommodation.db)")
    ap.add_argument("--csv", default=None, help="CSV path (defaults: ALLOTMENT_CSV env or allotment-data.csv)")
    args = ap.parse_args()

    # Resolve DB URL (no hardcoding)
    db_url = args.db \
        or os.getenv("DATABASE_URL") \
        or os.getenv("SQLALCHEMY_DATABASE_URL") \
        or os.getenv("SQLALCHEMY_DATABASE_URI")
    if not db_url:
        print("[FATAL] No DB URL. Set DATABASE_URL in .env or pass --db sqlite:///C:/.../accommodation.db")
        return 2

    db_url = normalize_sqlite_url(db_url)
    db_path = sqlite_path_from_url(db_url)

    # Open DB
    import sqlite3
    if db_path != ":memory:":
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys=ON;")
    cur = conn.cursor()

    # Schema check
    for t in ("house", "user", "allotment"):
        if not table_exists(cur, t):
            print(f"[FATAL] table '{t}' not found in DB. Aborting.")
            return 2

    user_cols = get_columns(cur, "user")

    # CSV path
    csv_env = args.csv or os.getenv("ALLOTMENT_CSV") or "allotment-data.csv"
    csv_path = Path(csv_env)
    if not csv_path.is_absolute():
        # try CWD, then script dir
        if not csv_path.exists():
            csv_path = (Path.cwd() / csv_env)
        if not csv_path.exists():
            csv_path = (Path(__file__).resolve().parent / csv_env)
    if not csv_path.exists():
        print(f"[FATAL] CSV not found: {csv_env}")
        return 2

    inserts = updates = skip_no_house = skip_no_key = 0

    f, used_enc = open_csv_with_fallback(csv_path)
    print(f"[INFO] DB: {db_url}")
    print(f"[INFO] CSV: {csv_path}  (encoding={used_enc})")

    with f:
        rdr = csv.DictReader(f)
        for col in (FILE_NO_COL, CNIC_COL, NAME_COL, DATE_FROM_COL, DATE_TO_COL):
            if col not in (rdr.fieldnames or []):
                print(f"[WARN] column '{col}' not in CSV; continuing")

        for r in rdr:
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

            # unique-by: (house_id, user_id, date_from)
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

    conn.commit()
    print(f"[RESULT] inserts={inserts}, updates={updates}, skipped_no_key={skip_no_key}, skipped_no_house={skip_no_house}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
