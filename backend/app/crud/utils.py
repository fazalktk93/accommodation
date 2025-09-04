from sqlalchemy.orm import Query

def paginate(q: Query, skip: int, limit: int) -> Query:
    # hard cap page size for safety
    limit = max(1, min(int(limit or 5000), 100))
    skip = max(0, int(skip or 0))
    return q.offset(skip).limit(limit)
