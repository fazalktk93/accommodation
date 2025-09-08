import sqlite3, json

DB_PATH = "accommodation.db"
USERNAME = "admin"   # change to your username

needed = {
    "houses:read","houses:create","houses:update","houses:delete",
    "allotments:read","allotments:create","allotments:update","allotments:delete"
}

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

cur.execute("SELECT id, username, permissions FROM user WHERE username=?", (USERNAME,))
row = cur.fetchone()
if not row:
    raise SystemExit("User not found")

uid, uname, perms = row
try:
    current = set(json.loads(perms)) if perms else set()
except Exception:
    current = set()

updated = sorted(current.union(needed))
cur.execute("UPDATE user SET permissions=? WHERE id=?", (json.dumps(updated), uid))
conn.commit()
print("✅ Updated permissions for", uname, "→", updated)
