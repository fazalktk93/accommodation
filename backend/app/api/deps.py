# app/api/deps.py
from typing import Optional, Dict
from fastapi import Query

# raise or lower to what you want the API to allow
MAX_LIMIT = 5000

def pagination_params(
    # accept BOTH names; prefer `offset` if present, otherwise `skip`
    offset: Optional[int] = Query(None, ge=0, description="Alias: skip"),
    skip: Optional[int]   = Query(None, ge=0, description="Alias: offset"),
    limit: int            = Query(100, ge=1, le=MAX_LIMIT),
) -> Dict[str, int]:
    _offset = offset if offset is not None else (skip or 0)
    return {"offset": _offset, "limit": limit}
