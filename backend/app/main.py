from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.session import engine
from app.api.routes import houses, allotments, files, health
from app.models import Base

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[],                       # use regex instead (below)
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
    # make sure models are imported
    from app import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
