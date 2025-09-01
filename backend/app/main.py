# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import Base, engine
from .config import settings
from .routers import (
    auth,
    users,
    meta,
    employees,
    houses,
    applications,
    allotments,
    recordroom,
    gwl,
)

def create_app() -> FastAPI:
    app = FastAPI(title="House Allotment Management System (FastAPI)")
    Base.metadata.create_all(bind=engine)

    print(f"[APP] DATABASE_URL in use: {settings.database_url}")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Public/auth
    app.include_router(auth.router)

    # Protected/resources
    app.include_router(users.router)
    app.include_router(meta.router)
    app.include_router(employees.router)
    app.include_router(houses.router)
    app.include_router(applications.router)
    app.include_router(allotments.router)
    app.include_router(recordroom.router)
    app.include_router(gwl.router)  # General Waiting List (CRUD)

    return app

app = create_app()
