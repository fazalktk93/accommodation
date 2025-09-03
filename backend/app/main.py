from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.logging_config import setup_logging
from app.db.session import engine
from app.db.bootstrap import ensure_sqlite_schema  # <-- ADD THIS
from app.api.routes import houses, allotments, files, health
from app.api.routes import auth, users
from app.models import Base


setup_logging()
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
app.include_router(houses.router, prefix='/houses')
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")

@app.middleware("http")
async def log_requests(request: Request, call_next):
    import time, logging
    logger = logging.getLogger("app.request")
    start = time.time()
    response = await call_next(request)
    duration = round((time.time() - start) * 1000, 2)
    logger.info("%s %s %s %sms", request.method, request.url.path, response.status_code, duration)
    return response

@app.on_event("startup")
def on_startup():
    # 1) upgrade existing SQLite schema in-place (idempotent)
    ensure_sqlite_schema(engine)

    # 2) create missing tables (no-ops if present)
    from app import models  # ensure models imported
    Base.metadata.create_all(bind=engine)
