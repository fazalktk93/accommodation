from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.logging_config import setup_logging
from app.db.session import engine
from app.db.bootstrap import ensure_sqlite_schema
from app.api.routes import houses, allotments, files, health
from app.api.routes import auth, users
from app.models import Base

# -----------------------------------------------------------------------------
# App & logging
# -----------------------------------------------------------------------------
setup_logging()
app = FastAPI()

# -----------------------------------------------------------------------------
# CORS
# -----------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[],  # restrict in production!
    allow_origin_regex=settings.BACKEND_CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# Routers (all under /api)
# -----------------------------------------------------------------------------
app.include_router(houses.router, prefix="/api")
app.include_router(allotments.router, prefix="/api")
app.include_router(files.router, prefix="/api")
app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")

# -----------------------------------------------------------------------------
# Request logging middleware
# -----------------------------------------------------------------------------
@app.middleware("http")
async def log_requests(request: Request, call_next):
    import time, logging
    logger = logging.getLogger("app.request")
    start = time.time()
    response = await call_next(request)
    duration = round((time.time() - start) * 1000, 2)
    logger.info("%s %s %s %sms", request.method, request.url.path, response.status_code, duration)
    return response

# -----------------------------------------------------------------------------
# Startup: ensure DB schema
# -----------------------------------------------------------------------------
@app.on_event("startup")
def on_startup():
    ensure_sqlite_schema(engine)
    from app import models
    Base.metadata.create_all(bind=engine)

# -----------------------------------------------------------------------------
# SQLAdmin: admin panel at /admin
# -----------------------------------------------------------------------------
from sqladmin import Admin, ModelView
from starlette.authentication import AuthenticationBackend, AuthCredentials, SimpleUser
from starlette.requests import HTTPConnection
import jwt
from app.core.security import SECRET_KEY, ALGORITHM
from app.db.session import get_session
from app.models.user import User, Role
from sqlalchemy import select

class AdminAuthBackend(AuthenticationBackend):
    async def authenticate(self, conn: HTTPConnection):
        auth = conn.headers.get("authorization") or ""
        if not auth.lower().startswith("bearer "):
            return
        token = auth.split(" ", 1)[1].strip()
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            username = payload.get("sub")
        except Exception:
            return
        # Load user from DB
        with next(get_session()) as db:
            user = db.scalar(select(User).where(User.username == username))
            if not user or not user.is_active or user.role != Role.admin.value:
                return
        return AuthCredentials(["authenticated"]), SimpleUser(username)

admin = Admin(app, engine, authentication_backend=AdminAuthBackend())

# Register models with admin
from app.models.house import House
from app.models.allotment import Allotment
from app.models.file_movement import FileMovement

class UserAdmin(ModelView, model=User):
    column_list = [User.id, User.username, User.role, User.is_active, User.email]
    form_excluded_columns = ["hashed_password"]  # hide raw password
    name_plural = "Users"

class HouseAdmin(ModelView, model=House):
    column_list = [House.id, House.file_no, House.qtr_no, House.sector, House.type_code, House.status]

class AllotmentAdmin(ModelView, model=Allotment):
    column_list = [Allotment.id, Allotment.house_id, Allotment.person_name, Allotment.qtr_status]

class FileMovementAdmin(ModelView, model=FileMovement):
    column_list = [
        FileMovement.id,
        FileMovement.file_no,
        FileMovement.issued_to,
        FileMovement.issue_date,
        FileMovement.due_date,
        FileMovement.returned_date,
    ]

admin.add_view(UserAdmin)
admin.add_view(HouseAdmin)
admin.add_view(AllotmentAdmin)
admin.add_view(FileMovementAdmin)
