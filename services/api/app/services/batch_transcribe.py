"""Fallback transcription: whole-file audio → text via Gemini (non-live)."""

from google import genai
from google.genai import types

from app.config import get_settings

_PROMPT = (
    "Transcribe this audio recording verbatim. Output only the transcript text — "
    "no headers, timestamps, speaker labels, or commentary."
)


async def transcribe_wav(
    wav_bytes: bytes, api_key: str | None = None, model: str | None = None
) -> str:
    settings = get_settings()
    client = genai.Client(api_key=api_key or settings.gemini_api_key)
    response = await client.aio.models.generate_content(
        model=model or settings.gemini_eval_model,
        contents=[
            types.Part.from_bytes(data=wav_bytes, mime_type="audio/wav"),
            _PROMPT,
        ],
    )
    return (response.text or "").strip()
