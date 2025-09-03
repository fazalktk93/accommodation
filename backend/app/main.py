from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel

from app.core.config import settings
from app.db.session import engine
from app.api.routes import houses, allotments, files, health

app = FastAPI()

# CORS: regex-based, no hardcoded IPs
app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_origin_regex=settings.BACKEND_CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers under /api
app.include_router(houses.router, prefix="/api")
app.include_router(allotments.router, prefix="/api")
app.include_router(files.router, prefix="/api")
app.include_router(health.router, prefix="/api")

# Dev table creation (use Alembic for prod)
@app.on_event("startup")
def on_startup():
    from app import models  # ensure models imported
    SQLModel.metadata.create_all(engine)
