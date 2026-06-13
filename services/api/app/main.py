from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import get_settings
from app.db import dispose_engine, init_engine
from app.routers import (
    challenges,
    live,
    live_coach_ws,
    profiles,
    progress,
    roleplay_ws,
    sessions,
    settings,
    text_lab,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_engine()
    yield
    await dispose_engine()


app = FastAPI(title="ōrātiō API", version="0.1.0", lifespan=lifespan)

app.include_router(profiles.router)
app.include_router(settings.router)
app.include_router(challenges.router)
app.include_router(sessions.router)
app.include_router(progress.router)
app.include_router(text_lab.router)
app.include_router(live.router)
app.include_router(roleplay_ws.router)
app.include_router(live_coach_ws.router)


@app.get("/health")
async def health() -> dict:
    settings = get_settings()
    return {
        "status": "ok",
        "environment": settings.environment,
        "db_configured": bool(settings.database_url),
        "gemini_configured": bool(settings.gemini_api_key),
    }
