import os, sys, logging, time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

# make sure /backend (this folder) is on the path so "schemas" (outside app) can be imported
BACKEND_DIR = os.path.dirname(__file__)  # /home/.../backend/app
PROJECT_DIR = os.path.dirname(BACKEND_DIR)  # /home/.../backend
if PROJECT_DIR not in sys.path:
    sys.path.insert(0, PROJECT_DIR)

from app.api.routes import houses, allotments, files, health  # noqa
from app.core.config import settings  # if you have it; otherwise safe to remove

app = FastAPI(title="Accommodation API", version="1.0.0")

# CORS (open for dev/prod behind nginx)
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

# request logging
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s:%(lineno)d | %(message)s")
log = logging.getLogger("app")

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    log.info(f"--> {request.method} {request.url.path}")
    try:
        resp = await call_next(request)
    except Exception:
        log.exception("!! Unhandled error")
        raise
    dur = (time.time() - start) * 1000
    log.info(f"<-- {request.method} {request.url.path} {resp.status_code} {dur:.1f}ms")
    return resp

# routers
app.include_router(health.router, prefix="/api")
app.include_router(houses.router, prefix="/api")
app.include_router(allotments.router, prefix="/api")
app.include_router(files.router, prefix="/api")

# create missing tables on startup (doesn't drop anything)
from app.db.base import Base  # noqa
from app.db.session import engine  # noqa

@app.on_event("startup")
def _create_tables():
    Base.metadata.create_all(bind=engine)
