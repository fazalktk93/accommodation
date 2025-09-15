#!/usr/bin/env python3
import csv, sqlite3, sys, os, re
from datetime import datetime

DB = "sqlite:////home/accommodation/backend/accommodation.db"
CSV = "allotment-data.csv"

# --- config / mapping ---
DATE_FROM_COL = "allotment_date"
DATE_TO_COL   = "vacation_date"
FILE_NO_COL   = "file_no"
CNIC_COL      = "cnic"          # we will create/find user by this
NAME_COL      = "person_name"   # fallback identity if CNIC blank

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
    # try to normalize common garbage like dd-mm-yy
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
    assert url.startswith("sqlite:")
    # strip "sqlite:" and leading slashes, then ensure absolute
    p = url.split(":",1)[1]
    # handle sqlite:////abs/path
    if p.startswith("////"):
        return p[3:]
    if p.startswith("///"):
        return p[2:]
    if p.startswith("//"):
        return p[1:]
    return p

def open_db(url: str) -> sqlite3.Connection:
    path = sqlite_path_from_url(url)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn

def get_house_id(cur, file_no: str) -> int | None:
    row = cur.execute("SELECT id FROM house WHERE file_no = ?", (file_no,)).fetchone()
    return row[0] if row else None

def get_or_create_user(cur, cnic: str | None, name: str | None) -> int | None:
    # we will use CNIC as the unique username; if missing, fallback to normalized name
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
    # password is required (NOT NULL); store a placeholder
    cur.execute(
        "INSERT INTO user (username, password, is_superuser) VALUES (?,?,0)",
        (username, "x")
    )
    return cur.lastrowid

def main():
    db_url = os.environ.get("SQLALCHEMY_DATABASE_URL", DB)
    csv_path = os.environ.get("ALLOTMENT_CSV", CSV)
    print("[INFO] DB:", db_url)
    print("[INFO] CSV:", csv_path)

    conn = open_db(db_url)
    cur = conn.cursor()

    # quick schema check
    need = {
        "house": ["id","file_no"],
        "user": ["id","username","password","is_superuser"],
        "allotment": ["id","house_id","user_id","date_from","date_to"],
    }
    for t, cols in need.items():
        cur.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name=?", (t,))
        if not cur.fetchone():
            print(f"[FATAL] table '{t}' not found in DB. Aborting.")
            return 2

    inserts = updates = skip_no_house = skip_no_key = 0

    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        rdr = csv.DictReader(f)
        # verify essential columns exist
        for col in (FILE_NO_COL, CNIC_COL, NAME_COL, DATE_FROM_COL, DATE_TO_COL):
            if col not in rdr.fieldnames:
                print(f"[WARN] column '{col}' not in CSV; continuing (not all are required)")
        batch = []
        for r in rdr:
            file_no = norm(r.get(FILE_NO_COL, ""))
            if not file_no:
                skip_no_key += 1
                continue

            cnic = norm(r.get(CNIC_COL, ""))
            name = norm(r.get(NAME_COL, ""))
            user_id = get_or_create_user(cur, cnic or None, name or None)
            if not user_id:
                # cannot link allotment to a user
                skip_no_key += 1
                continue

            house_id = get_house_id(cur, file_no)
            if not house_id:
                skip_no_house += 1
                continue

            date_from = parse_date(r.get(DATE_FROM_COL, "") or "")
            date_to   = parse_date(r.get(DATE_TO_COL, "") or "")

            # unique-by: (house_id, user_id, date_from)
            row = cur.execute(
                """SELECT id FROM allotment
                   WHERE house_id=? AND user_id=? AND IFNULL(date_from,'')=IFNULL(?, '')""",
                (house_id, user_id, date_from)
            ).fetchone()

            if row:
                cur.execute(
                    "UPDATE allotment SET date_to=? WHERE id=?",
                    (date_to, row[0])
                )
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
