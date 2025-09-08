import sqlite3, json, os, sys

DB = sys.argv[1] if len(sys.argv) > 1 else "accommodation.db"
abs_path = os.path.abspath(DB)
print("DB path:", abs_path)
print("Exists:", os.path.exists(abs_path), "Size(bytes):", os.path.getsize(abs_path) if os.path.exists(abs_path) else 0)

conn = sqlite3.connect(abs_path)
cur = conn.cursor()

def cnt(table):
    try:
        cur.execute(f"SELECT COUNT(*) FROM {table}")
        return cur.fetchone()[0]
    except Exception as e:
        return f"(missing) {e}"

try:
    cur.execute("PRAGMA journal_mode;")
    print("journal_mode:", cur.fetchone()[0])
except Exception as e:
    print("journal_mode err:", e)

print("users:", cnt("user"))
print("houses:", cnt("houses"))
print("allotments:", cnt("allotments"))

try:
    cur.execute("SELECT username, permissions FROM user LIMIT 5")
    for u, p in cur.fetchall():
        try:
            pjson = json.loads(p) if p else []
        except Exception:
            pjson = p
        print("user:", u, "perms:", pjson)
except Exception as e:
    print("peek users err:", e)

conn.close()
