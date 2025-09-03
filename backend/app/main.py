from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.session import engine
from app.db.bootstrap import ensure_sqlite_schema  # <-- ADD THIS
from app.api.routes import houses, allotments, files, health
from app.models import Base

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_origin_regex=settings.BACKEND_CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(houses.router, prefix="/api")
app.include_router(allotments.router, prefix="/api")
app.include_router(files.router, prefix="/api")
app.include_router(health.router, prefix="/api")

@app.on_event("startup")
def on_startup():
    # 1) upgrade existing SQLite schema in-place (idempotent)
    ensure_sqlite_schema(engine)

    # 2) create missing tables (no-ops if present)
    from app import models  # ensure models imported
    Base.metadata.create_all(bind=engine)
