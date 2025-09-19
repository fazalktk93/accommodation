# backend/app/main.py
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.logging_config import setup_logging
from app.db.session import engine
from app.db.bootstrap import ensure_sqlite_schema
from app.api.routes import houses, allotments, files, health, auth, users
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
    allow_origins=settings.BACKEND_CORS_ORIGINS or [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=settings.BACKEND_CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# quick one-liner to verify headers actually reach the API
@app.get(f"{settings.API_PREFIX}/_debug/echo-auth")
def echo_auth(request: Request):
    return {
        "authorization": request.headers.get("authorization"),
        "query_access_token": request.query_params.get("access_token"),
    }

# -----------------------------------------------------------------------------
# Routers (mounted under the configured API prefix, e.g. "/api" or "/api/v1")
# -----------------------------------------------------------------------------
app.include_router(auth.router,       prefix=settings.API_PREFIX)
app.include_router(users.router,      prefix=settings.API_PREFIX)
app.include_router(houses.router,     prefix=settings.API_PREFIX)
app.include_router(allotments.router, prefix=settings.API_PREFIX)
app.include_router(files.router,      prefix=settings.API_PREFIX)
app.include_router(health.router,     prefix=settings.API_PREFIX)

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
    from app import models  # noqa: F401
    Base.metadata.create_all(bind=engine)

# -----------------------------------------------------------------------------
# SQLAdmin: admin panel at /admin
# -----------------------------------------------------------------------------
from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
import jwt
from sqlalchemy import select

# Try to import SECRET_KEY from security; if not exported, derive from settings
try:
    from app.core.security import SECRET_KEY, ALGORITHM, verify_password, get_password_hash  # type: ignore
except Exception:  # SECRET_KEY may not be exported in newer security.py
    from app.core.security import ALGORITHM, verify_password, get_password_hash  # type: ignore
    _k = getattr(settings, "SECRET_KEY", None) or getattr(settings, "JWT_SECRET", None)
    if not _k:
        raise RuntimeError("SECRET_KEY/JWT_SECRET missing; set in .env")
    SECRET_KEY = _k  # type: ignore

from app.db.session import get_session
from app.models.user import User, Role
from app.models.house import House
from app.models.allotment import Allotment
from app.models.file_movement import FileMovement

# Sessions for SQLAdmin login
from starlette.middleware.sessions import SessionMiddleware
app.add_middleware(
    SessionMiddleware,
    secret_key=SECRET_KEY,   # derived above if not exported
    same_site="lax",
    https_only=False,        # set True if strictly HTTPS
    max_age=60 * 60 * 8,     # 8h
)

class AdminAuth(AuthenticationBackend):
    """SQLAdmin auth supporting form login & JWT; requires admin role."""

    def __init__(self, secret_key: str):
        super().__init__(secret_key=secret_key)

    async def login(self, request):
        """
        Handle POST /admin/login (form-encoded).
        Validates username/password from DB; requires active admin.
        """
        try:
            form = await request.form()
            username = (form.get("username") or "").strip()
            password = form.get("password") or ""
            if not username or not password:
                return False

            with next(get_session()) as db:
                user = db.scalar(select(User).where(User.username == username))
                if not user or not user.is_active:
                    return False
                if not verify_password(password, user.hashed_password):
                    return False

                role_val = user.role if isinstance(user.role, str) else user.role.value
                if role_val != Role.admin.value:
                    return False

            # success: mark session authenticated
            request.session["sqladmin_auth"] = True
            request.session["sqladmin_user"] = username
            return True
        except Exception:
            return False

    async def logout(self, request):
        request.session.pop("sqladmin_auth", None)
        request.session.pop("sqladmin_user", None)
        return True

    async def authenticate(self, request):
        # session-based (after /admin/login)
        if request.session.get("sqladmin_auth"):
            return True

        # JWT fallback (Authorization: Bearer <token> or access_token cookie)
        token = None
        auth = request.headers.get("authorization") or ""
        if auth.lower().startswith("bearer "):
            token = auth.split(" ", 1)[1].strip()
        if not token:
            token = request.cookies.get("access_token")
        if not token:
            return False

        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            username = payload.get("sub")
            if not username:
                return False
        except Exception:
            return False

        with next(get_session()) as db:
            user = db.scalar(select(User).where(User.username == username))
            if not user or not user.is_active:
                return False
            role_val = user.role if isinstance(user.role, str) else user.role.value
            if role_val != Role.admin.value:
                return False

        return True

# -----------------------------------------------------------------------------
# Custom User Form (WTForms) so "Password" shows in UI
# -----------------------------------------------------------------------------
from wtforms import Form, StringField, BooleanField, PasswordField, TextAreaField, SelectField
from wtforms.validators import DataRequired, Email, Optional

# Build choices from Role enum (admin/manager/viewer, etc.)
ROLE_CHOICES = [
    (r.value if hasattr(r, "value") else str(r),
     r.value if hasattr(r, "value") else str(r))
    for r in Role
]

class UserForm(Form):
    username = StringField("Username", validators=[DataRequired()])
    full_name = StringField("Full Name", validators=[Optional()])
    email = StringField("Email", validators=[Optional(), Email()])
    is_active = BooleanField("Is Active")
    role = SelectField("Role", choices=ROLE_CHOICES, validators=[DataRequired()])
    permissions = TextAreaField("Permissions", validators=[Optional()])
    password = PasswordField("Password")  # <-- visible field

class UserAdmin(ModelView, model=User):
    column_list = [User.id, User.username, User.role, User.is_active, User.email]
    name_plural = "Users"

    # Hide the DB column from the form
    form_excluded_columns = ["hashed_password"]
    # Use our custom WTForms form so Password renders
    form = UserForm

    # Accept both old/new SQLAdmin hook signatures
    async def on_model_change(
        self,
        form,
        model,
        is_created,
        request=None,
        db_session=None,
        *args,
        **kwargs
    ):
        pwd_value = None

        # 1) Try WTForms-bound value
        if hasattr(form, "password"):
            if getattr(form.password, "data", None):
                pwd_value = form.password.data
            elif getattr(form.password, "raw_data", None):
                raw = form.password.raw_data
                if isinstance(raw, (list, tuple)) and raw:
                    pwd_value = (raw[0] or "").strip()

        # 2) Fallback: read directly from Starlette request form
        if not pwd_value and request is not None:
            try:
                formdata = await request.form()  # cached by Starlette; safe to call
                candidate = formdata.get("password") or ""
                if candidate.strip():
                    pwd_value = candidate.strip()
            except Exception:
                pass

        # 3) Apply hashing / validation
        if pwd_value:
            model.hashed_password = get_password_hash(pwd_value)
        elif is_created:
            # still nothing → prevent NULL in DB
            raise ValueError("Password is required when creating a user.")
        # do not call super(); base impl is a no-op and avoids signature mismatches

class HouseAdmin(ModelView, model=House):
    column_list = [House.id, House.file_no, House.qtr_no, House.sector, House.type_code, House.status]

class AllotmentAdmin(ModelView, model=Allotment):
    column_list = [Allotment.id, Allotment.house_id, Allotment.person_name, Allotment.qtr_status]

class FileMovementAdmin(ModelView, model=FileMovement):
    column_list = [
        FileMovement.id, FileMovement.file_no, FileMovement.issued_to,
        FileMovement.issue_date, FileMovement.due_date, FileMovement.returned_date
    ]

# -----------------------------------------------------------------------------
# Instantiate Admin
# -----------------------------------------------------------------------------
admin = Admin(app, engine, authentication_backend=AdminAuth(secret_key=SECRET_KEY))
admin.add_view(UserAdmin)
admin.add_view(HouseAdmin)
admin.add_view(AllotmentAdmin)
admin.add_view(FileMovementAdmin)
