import uuid

from fastapi import APIRouter, HTTPException
from google import genai
from pydantic import BaseModel

from app.config import get_settings
from app.deps import CurrentUser, DbSession
from app.models import UserSettings
from app.services.gemini_config import AVAILABLE_EVAL_MODELS, resolve_for_user

router = APIRouter(prefix="/me", tags=["settings"])


class SettingsOut(BaseModel):
    has_api_key: bool
    api_key_hint: str | None  # last 4 chars, e.g. "…aB3x"
    using_own_key: bool
    eval_model: str           # effective model (own or server default)
    available_models: list[str]


class SettingsUpdate(BaseModel):
    gemini_api_key: str | None = None  # "" clears it (revert to server key)
    eval_model: str | None = None


def _out(row: UserSettings | None, effective_model: str) -> SettingsOut:
    key = row.gemini_api_key if row else None
    return SettingsOut(
        has_api_key=bool(key),
        api_key_hint=f"…{key[-4:]}" if key else None,
        using_own_key=bool(key),
        eval_model=effective_model,
        available_models=AVAILABLE_EVAL_MODELS,
    )


async def _validate_key(api_key: str, model: str) -> None:
    """Cheap liveness check so the user finds out immediately if the key is bad."""
    try:
        client = genai.Client(api_key=api_key)
        await client.aio.models.generate_content(model=model, contents="ping")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"That API key / model didn't work: {exc}") from exc


@router.get("/settings", response_model=SettingsOut)
async def get_user_settings(user: CurrentUser, db: DbSession) -> SettingsOut:
    row = await db.get(UserSettings, uuid.UUID(user.id))
    cfg = await resolve_for_user(db, user.id)
    return _out(row, cfg.eval_model)


@router.put("/settings", response_model=SettingsOut)
async def update_user_settings(
    body: SettingsUpdate, user: CurrentUser, db: DbSession
) -> SettingsOut:
    if body.eval_model is not None and body.eval_model not in AVAILABLE_EVAL_MODELS:
        raise HTTPException(status_code=422, detail="Unknown model")

    user_uuid = uuid.UUID(user.id)
    row = await db.get(UserSettings, user_uuid)
    if row is None:
        row = UserSettings(user_id=user_uuid)
        db.add(row)

    if body.gemini_api_key is not None:
        new_key = body.gemini_api_key.strip() or None
        if new_key:
            # Validate against the model they'll actually use.
            model = body.eval_model or row.eval_model or get_settings().gemini_eval_model
            await _validate_key(new_key, model)
        row.gemini_api_key = new_key

    if body.eval_model is not None:
        row.eval_model = body.eval_model

    await db.commit()
    await db.refresh(row)
    cfg = await resolve_for_user(db, user.id)
    return _out(row, cfg.eval_model)
