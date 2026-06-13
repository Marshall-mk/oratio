"""Resolve which Gemini API key + models to use for a given user.

Users can bring their own key and pick an evaluation model (Profile screen).
Anything unset falls back to the server defaults from the environment.
"""

import uuid
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import UserSettings

# Curated, structured-output-capable models offered in the picker.
AVAILABLE_EVAL_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-pro",
    "gemini-3.5-flash",
    "gemini-3.1-pro-preview",
]


@dataclass
class GeminiConfig:
    api_key: str
    eval_model: str
    live_model: str


async def resolve_for_user(db: AsyncSession, user_id: uuid.UUID | str) -> GeminiConfig:
    s = get_settings()
    if isinstance(user_id, str):
        user_id = uuid.UUID(user_id)
    row = await db.get(UserSettings, user_id)
    return GeminiConfig(
        api_key=(row.gemini_api_key if row and row.gemini_api_key else s.gemini_api_key),
        eval_model=(row.eval_model if row and row.eval_model else s.gemini_eval_model),
        live_model=(row.live_model if row and row.live_model else s.gemini_live_model),
    )
