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

    # Gemini
    gemini_api_key: str = ""
    gemini_live_model: str = "gemini-2.5-flash-native-audio-preview-12-2025"
    # Silent transcription (drills/coach/debate captions) uses the half-cascade
    # Live model: unlike the native-audio variant (kept for roleplay, which
    # needs spoken replies), it streams input transcription incrementally
    # instead of holding text until the turn is processed.
    gemini_transcriber_model: str = "gemini-live-2.5-flash-preview"
    gemini_eval_model: str = "gemini-2.5-pro"
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
