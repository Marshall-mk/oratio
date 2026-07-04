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
    gemini_eval_model: str = "gemini-2.5-pro"
    eval_with_audio: bool = False
    # BCP-47 hint for live input transcription; without it the model free-runs
    # language detection and can drift on ambiguous audio.
    transcription_language: str = "en-US"

    # Analytics
    posthog_api_key: str = ""
    posthog_host: str = "https://us.i.posthog.com"

    environment: str = "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()
