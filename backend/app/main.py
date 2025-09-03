import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from sqlalchemy import text
from sqlalchemy.exc import OperationalError, IntegrityError
from fastapi.responses import JSONResponse

from app.api.routes import houses, allotments, files, health
from app.core.config import settings
from app.db.session import engine

app = FastAPI(title="Accommodation API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=([] if settings.ENV == "production" else settings.BACKEND_CORS_ORIGINS),
    allow_origin_regex=(settings.BACKEND_CORS_ORIGIN_REGEX if settings.ENV != "production" else None),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1024)

app.include_router(health.router, prefix="/api")
app.include_router(houses.router, prefix="/api")
app.include_router(allotments.router, prefix="/api")
app.include_router(files.router, prefix="/api")

@app.on_event("startup")
def startup_ping_db():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except OperationalError:
        logging.exception("Database connection failed on startup")

@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    return JSONResponse(
        status_code=400,
        content={"detail": "Integrity error: likely a duplicate or constraint violation."},
    )
