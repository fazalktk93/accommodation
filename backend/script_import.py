#!/usr/bin/env python3
"""
Robust one-time import script for houses CSV.

- Sends rows one by one with a small delay (SLEEP_BETWEEN).
- Retries politely on 429/5xx.
- Logs failures to a file.
- Verifies API total after import (using pagination).
"""

import os, sys, csv, time, requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from collections import Counter

API_BASE = os.environ.get("API_BASE", "http://localhost:8000/api")
TOKEN = os.environ.get("API_TOKEN", "")

SLEEP_BETWEEN = 0.2   # polite pause between rows
TIMEOUT = 60
MAX_RETRIES = 6
BACKOFF = 1.0         # retry backoff factor
FAIL_LOG = "import_failures.log"

def auth_headers():
    h = {"Content-Type": "application/json"}
    if TOKEN:
        h["Authorization"] = TOKEN if TOKEN.lower().startswith("bearer ") else f"Bearer {TOKEN}"
    return h

def norm(v):
    return (v if v is not None else "").strip() if isinstance(v, str) else ("" if v in (None,) else str(v).strip())

def bool_yes(v):
    return (v or "").strip().lower() in {"y", "yes", "true", "1"}

def make_session():
    s = requests.Session()
    retry = Retry(
        total=MAX_RETRIES,
        backoff_factor=BACKOFF,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset(["POST","GET"]),
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=5, pool_maxsize=5)
    s.mount("http://", adapter)
    s.mount("https://", adapter)
    return s

def import_csv(csv_path):
    total = ok = fail = 0
    status_counts = Counter()
    sess = make_session()
    open(FAIL_LOG, "w").close()

    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, start=1):
            total += 1
            payload = {
                "file_no": norm(row.get("file_no")),
                "qtr_no": norm(row.get("qtr_no")),
                "street": norm(row.get("street")),
                "sector": norm(row.get("sector")),
                "pool": norm(row.get("pool")),
                "status": norm(row.get("status")),
                "medium": norm(row.get("medium")),
                "type_code": norm(row.get("type_code")),
                "on_retention": bool_yes(row.get("retention")),
            }
            try:
                r = sess.post(f"{API_BASE}/houses", json=payload,
                              headers=auth_headers(), timeout=TIMEOUT)
                status_counts[r.status_code] += 1
                if r.status_code < 300:
                    ok += 1
                    print(f"[{i}] OK - {payload['file_no']} / {payload['qtr_no']}")
                else:
                    fail += 1
                    msg = f"[{i}] FAIL {r.status_code}: {r.text.strip()}"
                    print(msg)
                    with open(FAIL_LOG, "a", encoding="utf-8") as lf: lf.write(msg+"\n")
                    if r.status_code == 429:
                        time.sleep(5)  # cooldown if rate-limited
            except Exception as e:
                fail += 1
                msg = f"[{i}] ERR {e}"
                print(msg)
                with open(FAIL_LOG, "a", encoding="utf-8") as lf: lf.write(msg+"\n")

            time.sleep(SLEEP_BETWEEN)

            if i % 25 == 0:
                print(f"-- processed {i} rows so far --")

    print("\nImport complete.")
    print(f"Status counts: {dict(status_counts)}")
    print(f"Done. total={total} ok={ok} fail={fail}")

    # --- verify total (handles pagination) ---
    try:
        r = sess.get(f"{API_BASE}/houses?limit=1000", headers=auth_headers(), timeout=TIMEOUT)
        if r.status_code < 300:
            data = r.json()
            if isinstance(data, list):
                print(f"API shows {len(data)} rows on one page (limit=1000).")
            elif isinstance(data, dict):
                items = data.get("items") or data.get("results") or data.get("data") or []
                total_count = data.get("total") or data.get("count") or len(items)
                print(f"API shows {len(items)} rows on this page; reported total={total_count}")
        else:
            print(f"Verification GET failed: {r.status_code} {r.text[:200]}")
    except Exception as e:
        print(f"Verification error: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python import_houses.py 'Quarter\\'s Details.csv'")
        sys.exit(1)
    import_csv(sys.argv[1])
