from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.session import get_session
from app.schemas.user import UserRead, UserCreate
from app.models.user import User, Role
from app.core.security import get_current_user, require_roles
from app.core.logging_config import audit_logger
from app.crud.user import create as create_user_crud

router = APIRouter(prefix="/users", tags=["users"])

def get_db():
    yield from get_session()

@router.post("/", response_model=UserRead, status_code=201, dependencies=[Depends(require_roles(Role.admin, Role.manager))])
def create_user(payload: UserCreate, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    existing = db.scalar(select(User).where(User.username == payload.username))
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    created = create_user_crud(db, payload)
    audit_logger.emit(actor=actor.username, action="create", resource="user", resource_id=str(created.id), success=True)
    return created

@router.get("/", response_model=list[UserRead], dependencies=[Depends(require_roles(Role.admin, Role.manager))])
def list_users(db: Session = Depends(get_db)):
    return db.scalars(select(User)).all()
