#!/usr/bin/env python3
"""
One-time import script for houses CSV.

Expected CSV columns:
  file_no, qtr_no, street, sector, pool, status, retention, medium, type_code

Usage:
    pip install requests
    export API_BASE="http://localhost:8000/api"
    export API_TOKEN="eyJhbGciOi..."   # optional; if auth enabled
    python import_houses.py "Quarter's Details.csv"
"""

import os
import sys
import csv
import time
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

API_BASE = os.environ.get("API_BASE", "http://localhost:8000/api")
TOKEN = os.environ.get("API_TOKEN", "")

# tweak if server is touchy
SLEEP_BETWEEN = 0.05  # seconds between requests
TIMEOUT = 30
MAX_RETRIES = 3

def auth_headers():
    h = {"Content-Type": "application/json"}
    if TOKEN:
        h["Authorization"] = TOKEN if TOKEN.lower().startswith("bearer ") else f"Bearer {TOKEN}"
    return h

def norm(v):
    # Keep blanks as "" (not None) so backend doesn’t auto-default
    return (v if v is not None else "").strip() if isinstance(v, str) else ("" if v in (None,) else str(v).strip())

def bool_yes(v):
    return (v or "").strip().lower() in {"y", "yes", "true", "1"}

def make_session():
    s = requests.Session()
    # retry on 429/5xx, idempotent for POST is okay for one-time loader (server should ignore dups if any)
    retry = Retry(
        total=MAX_RETRIES,
        backoff_factor=0.5,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset(["POST", "GET"]),
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=20, pool_maxsize=20)
    s.mount("http://", adapter)
    s.mount("https://", adapter)
    return s

def main(csv_path):
    total = ok = fail = 0
    sess = make_session()

    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, start=1):
            total += 1

            payload = {
                "file_no": norm(row.get("file_no")),
                "qtr_no": norm(row.get("qtr_no")),
                "street": norm(row.get("street")),     # may be empty ""
                "sector": norm(row.get("sector")),
                "pool": norm(row.get("pool")),
                # IMPORTANT: keep empty as "" so backend doesn't default to 'vacant'
                "status": norm(row.get("status")),
                "medium": norm(row.get("medium")),
                "type_code": norm(row.get("type_code")),
                # retention: map yes->True else False (backend expects boolean)
                "on_retention": bool_yes(row.get("retention")),
            }

            # If your backend rejects empty strings for some fields, you can
            # selectively send None instead. For now, we keep blanks as "" to override defaults.

            try:
                r = sess.post(f"{API_BASE}/houses", json=payload, headers=auth_headers(), timeout=TIMEOUT)
                if r.status_code < 300:
                    ok += 1
                    print(f"[{i}] OK  - {payload['file_no']} / {payload['qtr_no']}")
                else:
                    fail += 1
                    print(f"[{i}] FAIL {r.status_code}: {r.text.strip()}")
            except Exception as e:
                fail += 1
                print(f"[{i}] ERR  {e}")

            if SLEEP_BETWEEN:
                time.sleep(SLEEP_BETWEEN)

    print(f"\nDone. total={total} ok={ok} fail={fail}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python import_houses.py 'Quarter\\'s Details.csv'")
        sys.exit(1)
    main(sys.argv[1])
