from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.session import engine
from app.api.routes import houses, allotments
from app.models import Base  # <-- use SQLAlchemy Base

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

@app.get("/api/health")
def health():
    return {"ok": True}

@app.on_event("startup")
def on_startup():
    # Ensure models are imported
    from app import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
