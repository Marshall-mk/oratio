"""Supabase Storage helpers (service-role access for backend-side reads)."""

import httpx

from app.config import get_settings


async def download_recording(storage_path: str) -> bytes:
    """Fetch a recording from the private bucket using the service-role key.

    Used by the fallback transcription path and (later) audio-aware evaluation.
    """
    settings = get_settings()
    url = f"{settings.supabase_url}/storage/v1/object/recordings/{storage_path}"
    headers = {
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "apikey": settings.supabase_service_role_key,
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(url, headers=headers)
        resp.raise_for_status()
        return resp.content
