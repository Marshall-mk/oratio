from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Supabase
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    # Local-dev only: the local Supabase stack signs JWTs with a shared HS256
    # secret instead of asymmetric JWKS. Leave empty in production.
    supabase_jwt_secret: str = ""
    database_url: str = ""

    # Gemini. Note: Google closed the 2.5 text-model family to newly created
    # accounts (mid-2026), so defaults target models every key can use.
    gemini_api_key: str = ""
    # Roleplay (spoken replies): the rolling native-audio alias survives
    # individual preview retirements.
    gemini_live_model: str = "gemini-2.5-flash-native-audio-latest"
    # Silent transcription (drills/coach/debate captions): a Live model that
    # streams input transcription instead of holding it until turn end.
    gemini_transcriber_model: str = "gemini-3.1-flash-live-preview"
    gemini_eval_model: str = "gemini-3.5-flash"
    eval_with_audio: bool = False
    # BCP-47 hint for live input transcription; without it the model free-runs
    # language detection and can drift on ambiguous audio.
    transcription_language: str = "en-US"
    # Live-API VAD: how much trailing silence ends a turn (and so flushes the
    # final piece of a transcription). Google recommends 500-800 ms; lower is
    # snappier captions, below ~500 fragments utterances.
    gemini_vad_silence_ms: int = 500

    # Analytics
    posthog_api_key: str = ""
    posthog_host: str = "https://us.i.posthog.com"

    environment: str = "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()
