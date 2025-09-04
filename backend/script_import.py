#!/usr/bin/env python3
"""
Polite, resumable import script for houses CSV.

Key features:
- Token-bucket rate limiter (default ~1 req/sec) to avoid throttling.
- Respects Retry-After on 429/503, with exponential backoff + jitter.
- Circuit breaker: long cool-down after many consecutive errors.
- Checkpoint/resume by file_no+qtr_no to avoid re-posting on reruns.
- Failure log + status histogram.
"""

import os, sys, csv, time, json, random
from collections import Counter
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# ------------- Config (env overridable) ----------------
API_BASE = os.environ.get("API_BASE", "http://localhost:8000/api").rstrip("/")
TOKEN = os.environ.get("API_TOKEN", "")

# polite pacing
RATE_LIMIT_RPS = float(os.environ.get("RATE_LIMIT_RPS", "1.0"))   # ~1 request/second
MIN_INTERVAL = 1.0 / max(RATE_LIMIT_RPS, 0.01)

TIMEOUT = int(os.environ.get("TIMEOUT", "60"))
MAX_RETRIES = int(os.environ.get("MAX_RETRIES", "0"))  # transport-level; app backoff handled manually
FAIL_LOG = os.environ.get("FAIL_LOG", "import_failures.log")
CHECKPOINT_FILE = os.environ.get("CHECKPOINT_FILE", "import_checkpoint.json")

# backoff tuning
BASE_BACKOFF = float(os.environ.get("BASE_BACKOFF", "1.0"))   # seconds
MAX_BACKOFF  = float(os.environ.get("MAX_BACKOFF", "60.0"))   # max sleep on backoff
ERR_COOLDOWN = float(os.environ.get("ERR_COOLDOWN", "30.0"))  # cool-down after error burst
ERR_BURST_N  = int(os.environ.get("ERR_BURST_N", "10"))       # errors in a row before cool-down

# --------------------------------------------------------

def auth_headers():
    h = {"Content-Type": "application/json"}
    if TOKEN:
        h["Authorization"] = TOKEN if TOKEN.lower().startswith("bearer ") else f"Bearer {TOKEN}"
    return h

def norm(v):
    return (v if v is not None else "").strip() if isinstance(v, str) else ("" if v in (None,) else str(v).strip())

def bool_yes(v):
    return (v or "").strip().lower() in {"y", "yes", "true", "1"}

def norm_status(v: str) -> str:
    """
    Normalize status values. Requirements:
      - fix 'vacnt' -> 'vacant'
      - do NOT force 'occupied' anywhere
      - if empty, return "" (leave blank)
    """
    s = (v or "").strip().lower()
    if not s:
        return ""  # leave blank exactly as requested

    mapping = {
        # vacant typos/variants
        "vacnt": "vacant",
        "vacent": "vacant",
        "vacn": "vacant",
        "vac": "vacant",
        "vacant": "vacant",

        # occupied variants (kept as 'occupied' only if explicitly provided)
        "occupied": "occupied",
        "occuppied": "occupied",
        "occ": "occupied",
        "active": "occupied",    # if your API expects 'active' instead, change this line
        "allocated": "occupied", # optional; remove if not desired
    }
    return mapping.get(s, s)  # unknown strings pass through unchanged

def make_session():
    s = requests.Session()
    # We do our own app-level backoff; keep transport retries minimal or zero.
    retry = Retry(
        total=MAX_RETRIES,
        backoff_factor=0.0,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset(["POST","GET"]),
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=4, pool_maxsize=4)
    s.mount("http://", adapter)
    s.mount("https://", adapter)
    return s

def id_key(file_no, qtr_no):
    # Unique-ish key for checkpointing
    return f"{(file_no or '').strip()}::{(qtr_no or '').strip()}"

def load_checkpoint():
    if not os.path.exists(CHECKPOINT_FILE):
        return set()
    try:
        with open(CHECKPOINT_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return set(data.get("done_keys", []))
    except Exception:
        return set()

def save_checkpoint(done_keys):
    try:
        with open(CHECKPOINT_FILE, "w", encoding="utf-8") as f:
            json.dump({"done_keys": sorted(done_keys)}, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

def polite_sleep_since(last_time, min_interval):
    now = time.time()
    delta = now - last_time
    if delta < min_interval:
        time.sleep(min_interval - delta)
        now = time.time()
    return now

def parse_retry_after(headers, default=None):
    ra = headers.get("Retry-After")
    if not ra:
        return default
    try:
        # seconds form
        return max(0.0, float(ra))
    except Exception:
        # HTTP-date form not handled; fall back
        return default

def import_csv(csv_path):
    total = ok = fail = skipped = 0
    status_counts = Counter()
    consecutive_errors = 0
    backoff = BASE_BACKOFF
    done_keys = load_checkpoint()

    sess = make_session()
    open(FAIL_LOG, "w", encoding="utf-8").close()

    last_request_time = 0.0

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
                # STATUS: normalize, fix 'vacnt' -> 'vacant', leave blank if empty
                "status": norm_status(row.get("status")),
                "medium": norm(row.get("medium")),
                "type_code": norm(row.get("type_code")),
                "on_retention": bool_yes(row.get("retention")),
            }

            key = id_key(payload["file_no"], payload["qtr_no"])
            if key in done_keys:
                skipped += 1
                if i % 50 == 0:
                    print(f"-- skipped already imported up to row {i} --")
                continue

            # Rate limit before sending
            last_request_time = polite_sleep_since(last_request_time, MIN_INTERVAL)

            try:
                r = sess.post(f"{API_BASE}/houses", json=payload, headers=auth_headers(), timeout=TIMEOUT)
                status_counts[r.status_code] += 1

                if r.status_code < 300:
                    ok += 1
                    consecutive_errors = 0
                    backoff = BASE_BACKOFF
                    done_keys.add(key)
                    if ok % 25 == 0:
                        save_checkpoint(done_keys)
                    print(f"[{i}] OK  {payload['file_no']} / {payload['qtr_no']} ({r.status_code})")

                else:
                    fail += 1
                    consecutive_errors += 1
                    body = (r.text or "").strip()
                    msg = f"[{i}] FAIL {r.status_code}: {body[:300]}"
                    print(msg)
                    with open(FAIL_LOG, "a", encoding="utf-8") as lf:
                        lf.write(msg + "\n")

                    # Respect Retry-After on throttling/service unavailable
                    if r.status_code in (429, 503):
                        retry_after = parse_retry_after(r.headers, default=None)
                        if retry_after is not None:
                            sleep_for = min(MAX_BACKOFF, float(retry_after))
                        else:
                            # exponential backoff with jitter
                            jitter = random.uniform(0, backoff * 0.25)
                            sleep_for = min(MAX_BACKOFF, backoff + jitter)
                            backoff = min(MAX_BACKOFF, backoff * 2)

                        print(f"--> throttled or unavailable, sleeping {sleep_for:.1f}s (Retry-After/backoff)")
                        time.sleep(sleep_for)
                    elif consecutive_errors >= ERR_BURST_N:
                        print(f"--> many errors in a row ({consecutive_errors}); cooling down {ERR_COOLDOWN:.0f}s")
                        time.sleep(ERR_COOLDOWN)
                        consecutive_errors = 0

            except Exception as e:
                fail += 1
                consecutive_errors += 1
                msg = f"[{i}] ERR {e}"
                print(msg)
                with open(FAIL_LOG, "a", encoding="utf-8") as lf:
                    lf.write(msg + "\n")
                if consecutive_errors >= ERR_BURST_N:
                    print(f"--> many errors in a row ({consecutive_errors}); cooling down {ERR_COOLDOWN:.0f}s")
                    time.sleep(ERR_COOLDOWN)
                    consecutive_errors = 0

            if i % 25 == 0:
                print(f"-- processed {i} rows (ok={ok} fail={fail} skipped={skipped}) --")

    # final checkpoint save
    save_checkpoint(done_keys)

    print("\nImport complete.")
    print(f"Status counts: {dict(status_counts)}")
    print(f"Done. total={total} ok={ok} fail={fail} skipped={skipped}")
    print(f"Failures logged to {FAIL_LOG}. Checkpoint: {CHECKPOINT_FILE}")

    # Post-import peek past default page size
    try:
        r = requests.get(f"{API_BASE}/houses?limit=1000", headers=auth_headers(), timeout=TIMEOUT)
        if r.status_code < 300:
            data = r.json()
            if isinstance(data, list):
                print(f"API shows {len(data)} items on one page (limit=1000).")
            elif isinstance(data, dict):
                items = data.get("items") or data.get("results") or data.get("data") or []
                total_count = data.get("total") or data.get("count") or len(items)
                print(f"API shows {len(items)} items on this page; reported total={total_count}")
        else:
            print(f"Verification GET failed: {r.status_code} {r.text[:200]}")
    except Exception as e:
        print(f"Verification error: {e}")

def main():
    if len(sys.argv) < 2:
        print("Usage: python import_houses.py 'Quarter\\'s Details.csv'")
        sys.exit(1)
    import_csv(sys.argv[1])

if __name__ == "__main__":
    main()
