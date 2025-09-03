from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel

from app.core.config import settings
from app.db.session import engine
from app.api.routes import houses, allotments, files, health

app = FastAPI()

# CORS: regex allows localhost/LAN without hardcoding IPs
app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_origin_regex=settings.BACKEND_CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers (all under /api)
app.include_router(houses.router, prefix="/api")
app.include_router(allotments.router, prefix="/api")
app.include_router(files.router, prefix="/api")
app.include_router(health.router, prefix="/api")

# Create tables on startup (dev). For prod, use Alembic migrations.
@app.on_event("startup")
def on_startup():
    from app import models  # ensure models are imported
    SQLModel.metadata.create_all(engine)
