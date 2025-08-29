from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .db import Base, engine
from .config import settings
from .routers import auth, users, meta, employees, houses, applications, allotments
from .config import settings
from .routers import record_room
app.include_router(record_room.router)

def create_app() -> FastAPI:
    app = FastAPI(title="House Allotment Management System (FastAPI)")
    Base.metadata.create_all(bind=engine)

    # 👇 add this line so you see the DB in logs
    print(f"[APP] DATABASE_URL in use: {settings.database_url}")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

def create_app() -> FastAPI:
    app = FastAPI(title="House Allotment Management System (FastAPI)")
    Base.metadata.create_all(bind=engine)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth.router)
    app.include_router(users.router)
    app.include_router(meta.router)
    app.include_router(employees.router)
    app.include_router(houses.router)
    app.include_router(applications.router)
    app.include_router(allotments.router)

    @app.get("/healthz")
    def healthz():
        return {"status": "ok"}

    return app

app = create_app()
