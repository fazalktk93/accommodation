#!/usr/bin/env python3
"""
Flush ALL data from your API (allotments first, then houses).

Usage:
  pip install requests
  export API_BASE="http://localhost:8000/api"
  export API_TOKEN="eyJhbGciOi..."        # optional if your API is open
  # Dry-run (shows what it will delete)
  python flush_all_data.py
  # Actually delete:
  python flush_all_data.py --force
  # Skip prompt:
  python flush_all_data.py --force --yes
"""

import os
import sys
import time
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

API_BASE = os.environ.get("API_BASE", "http://localhost:8000/api")
TOKEN = os.environ.get("API_TOKEN", "")

TIMEOUT = 30
RETRIES = 3
BACKOFF = 0.4
SLEEP_BETWEEN = 0.03

def auth_headers():
    h = {}
    if TOKEN:
        h["Authorization"] = TOKEN if TOKEN.lower().startswith("bearer ") else f"Bearer {TOKEN}"
    return h

def session_with_retries():
    s = requests.Session()
    r = Retry(
        total=RETRIES,
        backoff_factor=BACKOFF,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset(["GET", "DELETE"]),
        raise_on_status=False,
    )
    ad = HTTPAdapter(max_retries=r, pool_maxsize=20, pool_connections=20)
    s.mount("http://", ad)
    s.mount("https://", ad)
    return s

def fetch_list(sess, path):
    """Fetch list; supports array or {results:[...]}/{items:[...]}/{data:[...]}."""
    url = f"{API_BASE.rstrip('/')}/{path.lstrip('/')}"
    resp = sess.get(url, headers=auth_headers(), timeout=TIMEOUT)
    resp.raise_for_status()
    js = resp.json()
    if isinstance(js, list):
        return js
    for k in ("results", "items", "data"):
        if isinstance(js, dict) and isinstance(js.get(k), list):
            return js[k]
    return []

def delete_one(sess, path):
    url = f"{API_BASE.rstrip('/')}/{path.lstrip('/')}"
    r = sess.delete(url, headers=auth_headers(), timeout=TIMEOUT)
    return r.status_code, r.text

def confirm(prompt):
    try:
        return input(prompt).strip().lower() in ("y", "yes")
    except EOFError:
        return False

def main():
    import argparse
    ap = argparse.ArgumentParser(description="Flush ALL allotments and houses from API.")
    ap.add_argument("--force", action="store_true", help="Perform deletion (not just dry-run).")
    ap.add_argument("--yes", action="store_true", help="Skip interactive confirmation.")
    args = ap.parse_args()

    sess = session_with_retries()

    # Load current data
    try:
        allotments = fetch_list(sess, "/allotments")
    except Exception as e:
        print(f"Warning: couldn't list /allotments: {e}")
        allotments = []

    try:
        houses = fetch_list(sess, "/houses")
    except Exception as e:
        print(f"Error: couldn't list /houses: {e}")
        sys.exit(1)

    print(f"Found: {len(allotments)} allotments, {len(houses)} houses")

    if not args.force:
        print("\nDRY-RUN (no deletions performed). Use --force to actually delete.")
        return

    if not args.yes:
        if not confirm("This will DELETE ALL allotments and houses. Are you sure? [y/N] "):
            print("Aborted.")
            return

    # 1) Delete allotments first (to satisfy FKs)
    del_a = 0
    for a in allotments:
        aid = a.get("id")
        if not aid:
            continue
        code, text = delete_one(sess, f"/allotments/{aid}")
        if code < 300:
            del_a += 1
            print(f"allotment {aid}: OK")
        elif code == 404:
            print(f"allotment {aid}: not found")
        else:
            print(f"allotment {aid}: FAIL {code} {text.strip()}")
        if SLEEP_BETWEEN: time.sleep(SLEEP_BETWEEN)

    # 2) Delete houses
    del_h = 0
    for h in houses:
        hid = h.get("id")
        if not hid:
            continue
        code, text = delete_one(sess, f"/houses/{hid}")
        if code < 300:
            del_h += 1
            print(f"house {hid}: OK")
        elif code == 404:
            print(f"house {hid}: not found")
        else:
            print(f"house {hid}: FAIL {code} {text.strip()}")
        if SLEEP_BETWEEN: time.sleep(SLEEP_BETWEEN)

    print(f"\nDone. Deleted allotments: {del_a}, houses: {del_h}")

if __name__ == "__main__":
    main()
