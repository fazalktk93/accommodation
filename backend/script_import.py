#!/usr/bin/env python3
"""
One-time import script for houses_min_import.csv

Expected CSV columns:
  file_no, qtr_no, street, sector, pool, status, retention, medium, type_code

Usage:
    pip install requests pandas
    export API_BASE="http://localhost:8000/api"   # or your prod URL
    export API_TOKEN="046b647b2f812a1efcbfc16690446bc299dfee1a9011cb89b359ca378b3bbec3"                        # if you use auth
    python import_houses.py "Quarter's Details.csv"
"""

import os
import sys
import csv
import requests

API_BASE = os.environ.get("API_BASE", "http://localhost:8000/api")
TOKEN = os.environ.get("API_TOKEN", "")  # set to your bearer token if required

def auth_headers():
    h = {"Content-Type": "application/json"}
    if TOKEN:
        h["Authorization"] = f"Bearer {TOKEN}"
    return h

def main(csv_path):
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, start=1):
            payload = {
                "file_no": row.get("file_no") or None,
                "qtr_no": row.get("qtr_no") or None,
                "street": row.get("street") or None,
                "sector": row.get("sector") or None,
                "pool": row.get("pool") or None,
                "status": row.get("status") or None,
                "medium": row.get("medium") or None,
                "type_code": row.get("type_code") or None,
                # retention is just a yes/no flag in your CSV
                "on_retention": (row.get("retention", "").lower() == "yes"),
            }

            try:
                r = requests.post(f"{API_BASE}/houses", json=payload, headers=auth_headers())
                if r.status_code >= 300:
                    print(f"[{i}] Failed: {r.status_code} {r.text}")
                else:
                    print(f"[{i}] Imported house {payload['file_no']} / {payload['qtr_no']}")
            except Exception as e:
                print(f"[{i}] Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python import_houses.py houses_min_import.csv")
        sys.exit(1)
    main(sys.argv[1])
