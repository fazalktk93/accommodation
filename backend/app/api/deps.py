# app/api/deps.py
from typing import Optional, Dict
from fastapi import Query
from app.core.config import settings

def pagination_params(
    # accepted inputs
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, alias="pageSize"),
    per_page: Optional[int] = Query(None, ge=1, alias="per_page"),
    limit: Optional[int] = Query(None, ge=1),
    skip: Optional[int] = Query(None, ge=0),
    offset: Optional[int] = Query(None, ge=0, alias="offset"),
) -> Dict[str, int]:
    # derive limit
    _limit = (
        page_size or per_page or limit or settings.DEFAULT_PAGE_LIMIT
    )
    _limit = max(1, min(_limit, settings.MAX_PAGE_LIMIT))  # clamp

    # derive offset/skip
    if offset is not None:
        _offset = offset
    elif skip is not None:
        _offset = skip
    elif page is not None:
        _offset = (page - 1) * _limit
    else:
        _offset = 0

    return {"offset": _offset, "limit": _limit}
