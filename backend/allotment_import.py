#!/usr/bin/env python3
import csv, sqlite3, sys, os, re
from datetime import datetime
from pathlib import Path
from typing import Optional

# --- env loading (no hardcoding) ---
def load_env():
    try:
        from dotenv import load_dotenv, find_dotenv
    except Exception:
        # dotenv not installed; that's fine if env vars are already set
        return
    # Try: current dir, script dir, then default search
    script_dir = Path(__file__).resolve().parent
    for candidate in (script_dir / ".env", script_dir.parent / ".env"):
        if candidate.exists():
            load_dotenv(candidate, override=False)
    load_dotenv(override=False)  # final pass (walks up parents)

def resolve_db_url(cli_db: Optional[str]) -> str:
    """Prefer CLI, else .env/ENV. Fail loudly if not found."""
    load_env()
    for key in (cli_db,
                os.getenv("DATABASE_URL"),
                os.getenv("SQLALCHEMY_DATABASE_URL"),
                os.getenv("SQLALCHEMY_DATABASE_URI")):
        if key:
            return key
    raise SystemExit(
        "No database URL provided.\n"
        "Set DATABASE_URL (or SQLALCHEMY_DATABASE_URL/URI) in your .env, "
        "or pass --db sqlite:////abs/path/to/accommodation.db"
    )

# --- config / mapping ---
DATE_FROM_COL = "allotment_date"
DATE_TO_COL   = "vacation_date"
FILE_NO_COL   = "file_no"
CNIC_COL      = "cnic"          # create/find user by this
NAME_COL      = "person_name"   # fallback identity if CNIC blank
DEFAULT_PASSWORD = "changeme"

# --- hashing helpers (robust fallbacks) ---
def _get_hasher():
    try:
        from passlib.context import CryptContext
        ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
        return lambda p: ctx.hash(p)
    except Exception:
        try:
            import bcrypt as _bcrypt
            def _hash(p: str) -> str:
                return _bcrypt.hashpw(p.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")
            return _hash
        except Exception:
            # last resort: bcrypt-like string (OK if these users never log in)
            def _dummy(p: str) -> str:
                return "$2b$12$" + ("x"*53)
            return _dummy

hash_password = _get_hasher()

# --- helpers ---
def parse_date(s: str) -> str | None:
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
        d,mn,yy = map(int, m.groups())
        yyyy = 2000+yy if yy < 70 else 1900+yy
        try:
            return datetime(yyyy, mn, d).date().isoformat()
        except ValueError:
            return None
    return None

def norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())

def sqlite_path_from_url(url: str) -> str:
    if not url.startswith("sqlite:"):
        raise SystemExit(f"Only sqlite URLs are supported by this script, got: {url!r}")
    p = url.split(":",1)[1]
    if p.startswith("////"): return p[3:]
    if p.startswith("///"):  return p[2:]
    if p.startswith("//"):   return p[1:]
    return p

def open_db(url: str) -> sqlite3.Connection:
    path = sqlite_path_from_url(url)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn

def table_exists(cur, name: str) -> bool:
    return cur.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)).fetchone() is not None

def get_columns(cur, table: str) -> set[str]:
    return {r[1] for r in cur.execute(f"PRAGMA table_info('{table}')").fetchall()}

def get_house_id(cur, file_no: str) -> int | None:
    row = cur.execute("SELECT id FROM house WHERE file_no = ?", (file_no,)).fetchone()
    return row[0] if row else None

def get_or_create_user(cur, user_cols: set[str], cnic: str | None, name: str | None) -> int | None:
    # Build username from CNIC or normalized name
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

    # Insert with new-schema fields when available
    payload_cols, payload_vals = [], []
    def add(col, val):
        if col in user_cols:
            payload_cols.append(col); payload_vals.append(val)

    add("username", username)
    add("full_name", name or None)
    add("hashed_password", hash_password(DEFAULT_PASSWORD))  # NOT NULL in new schema
    add("is_active", 1)
    add("role", "viewer")
    add("permissions", None)
    # legacy, if they exist
    add("password", None)
    add("is_superuser", 0)

    cols_sql = ", ".join(payload_cols)
    qs_sql   = ", ".join(["?"] * len(payload_cols))
    cur.execute(f"INSERT INTO user ({cols_sql}) VALUES ({qs_sql})", payload_vals)
    return cur.lastrowid

def main():
    # Args
    import argparse
    ap = argparse.ArgumentParser(description="Allotment CSV importer (uses .env for DB)")
    ap.add_argument("--db", default=None, help="Override DB URL (e.g. sqlite:////.../accommodation.db)")
    ap.add_argument("--csv", default=None, help="CSV path (default: env ALLOTMENT_CSV or allotment-data.csv)")
    args = ap.parse_args()

    db_url = resolve_db_url(args.db)
    csv_path = args.csv or os.getenv("ALLOTMENT_CSV") or "allotment-data.csv"

    print("[INFO] DB:", db_url)
    print("[INFO] CSV:", csv_path)

    conn = open_db(db_url)
    cur = conn.cursor()

    # quick schema check
    for t in ("house", "user", "allotment"):
        if not table_exists(cur, t):
            print(f"[FATAL] table '{t}' not found in DB. Aborting.")
            return 2

    user_cols = get_columns(cur, "user")

    inserts = updates = skip_no_house = skip_no_key = 0

    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        rdr = csv.DictReader(f)
        for col in (FILE_NO_COL, CNIC_COL, NAME_COL, DATE_FROM_COL, DATE_TO_COL):
            if col not in rdr.fieldnames:
                print(f"[WARN] column '{col}' not in CSV; continuing (not all are required)")

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

            row = cur.execute(
                """SELECT id FROM allotment
                   WHERE house_id=? AND user_id=? AND IFNULL(date_from,'')=IFNULL(?, '')""",
                (house_id, user_id, date_from)
            ).fetchone()

            if row:
                cur.execute("UPDATE allotment SET date_to=? WHERE id=?", (date_to, row[0]))
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
