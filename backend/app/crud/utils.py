def paginate(query, skip: int = 0, limit: int = 50):
    return query.offset(max(skip, 0)).limit(min(max(limit, 1), 200))
