#!/usr/bin/env python3
"""
One-time import script for houses CSV + post-import verification.

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
import json
from collections import Counter
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

API_BASE = os.environ.get("API_BASE", "http://localhost:8000/api")
TOKEN = os.environ.get("API_TOKEN", "")

# --- Tunables (a bit more conservative) ---
SLEEP_BETWEEN = float(os.environ.get("SLEEP_BETWEEN", "0.20"))  # seconds between requests
TIMEOUT = int(os.environ.get("TIMEOUT", "60"))
MAX_RETRIES = int(os.environ.get("MAX_RETRIES", "8"))
BACKOFF = float(os.environ.get("BACKOFF", "1.0"))  # Retry backoff factor

FAIL_LOG = os.environ.get("FAIL_LOG", "import_failures.log")

def auth_headers():
    h = {"Content-Type": "application/json"}
    if TOKEN:
        h["Authorization"] = TOKEN if TOKEN.lower().startswith("bearer ") else f"Bearer {TOKEN}"
    return h

def norm(v):
    # Keep blanks as "" (not None) so backend doesn’t auto-default unless you change it below
    return (v if v is not None else "").strip() if isinstance(v, str) else ("" if v in (None,) else str(v).strip())

def bool_yes(v):
    return (v or "").strip().lower() in {"y", "yes", "true", "1"}

def make_session():
    s = requests.Session()
    retry = Retry(
        total=MAX_RETRIES,
        backoff_factor=BACKOFF,  # 1s, 2s, 4s, ...
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset(["POST", "GET"]),
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=20, pool_maxsize=20)
    s.mount("http://", adapter)
    s.mount("https://", adapter)
    return s

# -------- Verification helpers (handle common pagination styles) --------

def try_get_total_header(sess):
    """
    Hit a tiny page and see if the API exposes total via header (e.g. X-Total-Count).
    """
    try:
        r = sess.get(f"{API_BASE}/houses?limit=1", headers=auth_headers(), timeout=TIMEOUT)
        if r.status_code < 300:
            for k, v in r.headers.items():
                if k.lower() in ("x-total-count", "x-total", "x-count", "x-totalitems"):
                    try:
                        return int(v)
                    except Exception:
                        pass
    except Exception:
        pass
    return None

def fetch_page(sess, params):
    r = sess.get(f"{API_BASE}/houses", params=params, headers=auth_headers(), timeout=TIMEOUT)
    if r.status_code >= 300:
        raise RuntimeError(f"GET /houses failed {r.status_code}: {r.text[:200]}")
    data = r.json()
    # common shapes: list[...]  OR  {"items":[...], "total": N} OR {"data":[...], "count": N}
    if isinstance(data, list):
        items = data
        total = None
    elif isinstance(data, dict):
        items = data.get("items") or data.get("data") or data.get("results") or []
        total = data.get("total") or data.get("count") or data.get("totalCount")
    else:
        items, total = [], None
    return items, total

def enumerate_all(sess, prefer="offset", page_size=500, max_pages=200):
    """
    Walk the collection to count everything, regardless of UI default page size.
    Tries limit/offset first, then page/per_page, then a single jumbo page.
    """
    # 1) limit/offset
    counted = 0
    if prefer == "offset":
        offset = 0
        for _ in range(max_pages):
            items, total = fetch_page(sess, {"limit": page_size, "offset": offset})
            counted += len(items)
            if total is not None:
                # trust server total if given
                return int(total), counted
            if len(items) < page_size:
                return counted, counted
            offset += page_size

    # 2) page/per_page
    page = 1
    counted = 0
    for _ in range(max_pages):
        items, total = fetch_page(sess, {"per_page": page_size, "page": page})
        counted += len(items)
        if total is not None:
            return int(total), counted
        if len(items) < page_size:
            return counted, counted
        page += 1

    # 3) single jumbo page attempt
    items, total = fetch_page(sess, {"limit": 100000})
    if total is not None:
        return int(total), len(items)
    return len(items), len(items)

# -------------------------- Import logic --------------------------

def import_csv(csv_path):
    total = ok = fail = 0
    status_counts = Counter()
    sess = make_session()

    # truncate failure log
    open(FAIL_LOG, "w", encoding="utf-8").close()

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

            try:
                r = sess.post(f"{API_BASE}/houses", json=payload, headers=auth_headers(), timeout=TIMEOUT)
                status_counts[r.status_code] += 1
                if r.status_code < 300:
                    ok += 1
                    print(f"[{i}] OK  - {payload['file_no']} / {payload['qtr_no']} ({r.status_code})")
                else:
                    fail += 1
                    msg = f"[{i}] FAIL {r.status_code}: {r.text.strip()}"
                    print(msg)
                    with open(FAIL_LOG, "a", encoding="utf-8") as lf:
                        lf.write(msg + "\n")
                    # Optional cool-down on 429
                    if r.status_code == 429:
                        time.sleep(5)
            except Exception as e:
                fail += 1
                msg = f"[{i}] ERR  {e}"
                print(msg)
                with open(FAIL_LOG, "a", encoding="utf-8") as lf:
                    lf.write(msg + "\n")

            if SLEEP_BETWEEN:
                time.sleep(SLEEP_BETWEEN)

            if i % 25 == 0:
                print(f"-- processed {i} rows so far --")

    print("\nImport complete.")
    print(f"Status counts: {dict(status_counts)}")
    print(f"Done. total={total} ok={ok} fail={fail}")
    if fail:
        print(f"Failures written to {FAIL_LOG}")

    # --------------- Post-import verification ---------------
    print("\nVerifying totals in API (pagination-aware)...")
    total_hdr = try_get_total_header(sess)
    if total_hdr is not None:
        print(f"Server header total reports: {total_hdr} items")
    total_seen, iter_count = enumerate_all(sess, prefer="offset", page_size=500)
    print(f"API enumeration: total={total_seen} (iterated={iter_count})")
    print("\nTip: If your UI only shows ~50 rows, that’s likely just a page size. Go to page 2 or increase rows/page.")

def main():
    if len(sys.argv) < 2:
        print("Usage: python import_houses.py 'Quarter\\'s Details.csv'")
        sys.exit(1)
    csv_path = sys.argv[1]
    import_csv(csv_path)

if __name__ == "__main__":
    main()
