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
    from app import models  # noqa: F401
    Base.metadata.create_all(bind=engine)

# -----------------------------------------------------------------------------
# SQLAdmin: admin panel at /admin
# -----------------------------------------------------------------------------
from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
import jwt
from sqlalchemy import select

from app.core.security import SECRET_KEY, ALGORITHM, verify_password, get_password_hash
from app.db.session import get_session
from app.models.user import User, Role
from app.models.house import House
from app.models.allotment import Allotment
from app.models.file_movement import FileMovement

# Sessions for SQLAdmin login
from starlette.middleware.sessions import SessionMiddleware
app.add_middleware(
    SessionMiddleware,
    secret_key=SECRET_KEY,
    same_site="lax",
    https_only=False,       # set True if strictly HTTPS
    max_age=60 * 60 * 8,    # 8h
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

# Build choices from Role enum (admin/viewer, etc.)
ROLE_CHOICES = [(r.value if hasattr(r, "value") else str(r),
                r.value if hasattr(r, "value") else str(r)) for r in Role]

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
    form_excluded_columns = ["hashed_password"]
    form = UserForm  # your custom WTForms Form with `password = PasswordField("Password")`

    async def on_model_change(
        self,
        form,
        model,
        is_created,
        request=None,
        db_session=None,
        *args,
        **kwargs,
    ):
        # Get password from either .data or .raw_data (some SQLAdmin/WTForms combos only populate raw_data)
        pwd_value = None
        if hasattr(form, "password"):
            # try normal bound value
            if getattr(form.password, "data", None):
                pwd_value = form.password.data
            # fallback to raw_data list
            elif getattr(form.password, "raw_data", None):
                raw = form.password.raw_data
                if isinstance(raw, (list, tuple)) and raw:
                    pwd_value = (raw[0] or "").strip()

        if pwd_value:
            model.hashed_password = get_password_hash(pwd_value)
        elif is_created:
            # prevent NULL hashed_password on create
            raise ValueError("Password is required when creating a user.")
        # don't call super(); base impl is a no-op and avoids signature issues

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
